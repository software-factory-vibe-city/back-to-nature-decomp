import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { AutodecompConfig, PolicyFinding, SourcePolicyResult } from "./types.ts";

interface PolicyOptions {
  projectRoot: string;
  config: AutodecompConfig;
  functionName?: string;
  functionVram?: string;
  scanFunctions?: string[];
  functionVrams?: Record<string, string>;
  changedFiles?: string[];
  patch?: string;
}

function normalizedPath(path: string): string {
  return path.split(sep).join("/").replace(/^\.\//, "");
}

function allowed(config: AutodecompConfig, file: string): boolean {
  const normalized = normalizedPath(file);
  return config.integration.allowedRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

function allowlisted(config: AutodecompConfig, name: string | undefined, vram: string | undefined, kind: string): boolean {
  const keys = [name?.toLowerCase(), vram?.toLowerCase()].filter((key): key is string => Boolean(key));
  return keys.some((key) => config.sourcePolicy.allowlist[key]?.includes(kind));
}

function forbiddenLine(
  line: string,
  config: AutodecompConfig,
  functionName?: string,
  functionVram?: string,
): { kind: string; message: string } | undefined {
  if (/\bINCLUDE_ASM\s*\(/.test(line) && !allowlisted(config, functionName, functionVram, "include-asm")) {
    return { kind: "include-asm", message: "Assembly stub is forbidden for an ordinary compiled function" };
  }
  if (/\bregister\b[^;\n]*\b(?:__asm__|__asm)\s*\(/.test(line) && !allowlisted(config, functionName, functionVram, "register-asm")) {
    return { kind: "register-asm", message: "Hard-register pinning is forbidden" };
  }
  if (/\b(?:__asm__|__asm|asm)\s*(?:volatile\s*)?\(/.test(line)) {
    const compact = line.replace(/\s+/g, "");
    const emptyMemoryBarrier = compact.includes('__asm__volatile("":::"memory")') || compact.includes('__asm__("":::"memory")');
    if (emptyMemoryBarrier && config.sourcePolicy.allowEmptyMemoryBarrier) return undefined;
    if (!allowlisted(config, functionName, functionVram, "embedded-asm")) {
      return { kind: "embedded-asm", message: "Embedded assembly is forbidden for an ordinary compiled function" };
    }
  }
  return undefined;
}

function stripComments(line: string, inBlock: boolean): { code: string; inBlock: boolean } {
  let code = "";
  let index = 0;
  while (index < line.length) {
    if (inBlock) {
      const end = line.indexOf("*/", index);
      if (end < 0) return { code, inBlock: true };
      inBlock = false;
      index = end + 2;
      continue;
    }
    const block = line.indexOf("/*", index);
    const slash = line.indexOf("//", index);
    if (slash >= 0 && (block < 0 || slash < block)) {
      code += line.slice(index, slash);
      break;
    }
    if (block < 0) {
      code += line.slice(index);
      break;
    }
    code += line.slice(index, block);
    inBlock = true;
    index = block + 2;
  }
  return { code, inBlock };
}

function scanSourceFile(options: PolicyOptions, file: string, findings: PolicyFinding[]): void {
  const path = resolve(options.projectRoot, file);
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  let inBlock = false;
  for (let index = 0; index < lines.length; index++) {
    const stripped = stripComments(lines[index], inBlock);
    inBlock = stripped.inBlock;
    const violation = forbiddenLine(stripped.code, options.config, options.functionName, options.functionVram);
    if (violation) {
      findings.push({
        kind: violation.kind,
        file: normalizedPath(relative(options.projectRoot, path)),
        line: index + 1,
        message: violation.message,
        text: lines[index].trim(),
      });
    }
  }
}

function scanAddedPatch(options: PolicyOptions): PolicyFinding[] {
  if (!options.patch) return [];
  const findings: PolicyFinding[] = [];
  let file = "";
  let newLine = 0;
  for (const line of options.patch.split("\n")) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      newLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const text = line.slice(1);
      const trimmed = text.trim();
      const commentOnly = trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//");
      const violation = commentOnly ? undefined : forbiddenLine(text, options.config, options.functionName, options.functionVram);
      if (violation) findings.push({ kind: violation.kind, file, line: newLine, message: violation.message, text: text.trim() });
      if (file === "configs/flag_overrides.mk" && /^CC1FLAGS_\S+\s*:?=/.test(text) && !allowlisted(options.config, options.functionName, options.functionVram, "flag-override")) {
        findings.push({
          kind: "flag-override",
          file,
          line: newLine,
          message: "New per-function compiler flag overrides are forbidden",
          text: text.trim(),
        });
      }
      newLine++;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      newLine++;
    }
  }
  return findings;
}

export function checkSourcePolicy(options: PolicyOptions): SourcePolicyResult {
  const changedFiles = [...new Set((options.changedFiles ?? []).map(normalizedPath))].sort();
  const outOfScopeFiles = changedFiles.filter((file) => !allowed(options.config, file));
  const hardFailures: PolicyFinding[] = outOfScopeFiles.map((file) => ({
    kind: "out-of-scope",
    file,
    message: "Worker modified a path outside the configured integration roots",
  }));

  const scanNames = options.scanFunctions ?? (options.functionName ? [options.functionName] : []);
  for (const name of scanNames) {
    scanSourceFile(
      { ...options, functionName: name, functionVram: options.functionVrams?.[name] ?? (name === options.functionName ? options.functionVram : undefined) },
      `src/${name}.c`,
      hardFailures,
    );
  }

  const overrides = resolve(options.projectRoot, "configs", "flag_overrides.mk");
  if (existsSync(overrides)) {
    const lines = readFileSync(overrides, "utf8").split("\n");
    const names = options.functionName ? [options.functionName] : scanNames;
    for (const name of names) {
      const vram = options.functionVrams?.[name] ?? (name === options.functionName ? options.functionVram : undefined);
      if (allowlisted(options.config, name, vram, "flag-override")) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const index = lines.findIndex((line) => new RegExp(`^CC1FLAGS_${escaped}\\s*:?=`).test(line));
      if (index >= 0) {
        hardFailures.push({
          kind: "flag-override",
          file: "configs/flag_overrides.mk",
          line: index + 1,
          message: "Per-function compiler flag override is not allowlisted",
          text: lines[index].trim(),
        });
      }
    }
  }

  const newlyAddedForbiddenConstructs = scanAddedPatch(options);
  hardFailures.push(...newlyAddedForbiddenConstructs);

  return {
    pass: hardFailures.length === 0,
    hardFailures,
    warnings: [],
    changedFiles,
    outOfScopeFiles,
    newlyAddedForbiddenConstructs,
  };
}
