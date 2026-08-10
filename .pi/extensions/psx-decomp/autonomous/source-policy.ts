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

/**
 * A GCC *asm label* — `extern T sym[1] __asm__("NAME");` — renames the symbol
 * a declarator refers to. It emits no instructions, and it is how an
 * absolutely-addressed generated symbol is given a real aggregate type in the
 * override header. It is not embedded assembly and must not be policed as
 * such.
 *
 * Recognised narrowly, so instructions cannot enter through it: one plain
 * string operand that is a bare identifier (no colon operand lists, no
 * instruction text), preceded on the same line by a declarator, and closing a
 * declaration. Anything statement-initial, or following a `;`/`{`/`}`, is an
 * asm statement and stays forbidden. A register pin is a different construct
 * and is matched before this, on the `register` keyword.
 */
function asmLabel(line: string): boolean {
  const match = line.match(/\b(?:__asm__|__asm|asm)\s*\(\s*"([^"\\]*)"\s*\)\s*;\s*$/);
  if (!match || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(match[1])) return false;
  const declarator = line.slice(0, match.index).trim();
  return declarator.length > 0 && !/[;{}]$/.test(declarator);
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
  if (/\bregister\b[^;\n]*\b(?:__asm__|__asm|asm)\s*\(/.test(line) && !allowlisted(config, functionName, functionVram, "register-asm")) {
    return { kind: "register-asm", message: "Hard-register pinning is forbidden" };
  }
  /* `__volatile__` is the reserved spelling this project's C89 sources use;
   * matching only `volatile` let embedded asm through the gate unseen. */
  if (/\b(?:__asm__|__asm|asm)\s*(?:(?:__)?volatile(?:__)?\s*)?\(/.test(line)) {
    if (asmLabel(line)) return undefined;
    const compact = line.replace(/\s+/g, "").replace(/__volatile__/g, "volatile");
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

/**
 * A source file whose only code is the canonical `INCLUDE_ASM` placeholder is
 * a backlog stub: the function has not been decompiled yet. That is the normal
 * state of unfinished work, not a policy violation. A file that mixes
 * `INCLUDE_ASM` with any other code is *not* a stub — it is a partial fold,
 * and the scan must still see it.
 *
 * The per-function match gate and the controller's completion audit
 * deliberately do not use this: there, a remaining stub is a real failure.
 */
export function isPendingStub(source: string): boolean {
  let inBlock = false;
  const code: string[] = [];
  for (const line of source.split("\n")) {
    const stripped = stripComments(line, inBlock);
    inBlock = stripped.inBlock;
    const trimmed = stripped.code.trim();
    if (trimmed && !trimmed.startsWith("#")) code.push(trimmed);
  }
  return code.length === 1 && /^INCLUDE_ASM\s*\(.*\)\s*;?$/.test(code[0]);
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

/**
 * Attribute an added line to the function whose file it is in. Using the single
 * top-level `functionName` attributes every file to one function, and in a
 * repo-wide sweep that name is `undefined` — so no allowlist entry could ever
 * apply to a patch-added line, and an allowlisted construct failed the gate the
 * first time its own file was touched.
 */
/**
 * Only compiled translation units carry the construct ban: `src/**.c` and the
 * headers they include (where the narrow asm-label exception lives). A note or
 * a retro quoting `__asm__` is documentation — policing it would make the
 * repository unable to write down the very thing the policy is about.
 */
function policesConstructs(file: string): boolean {
  const path = normalizedPath(file);
  return /^src\/.*\.c$/.test(path) || /^include\/.*\.h$/.test(path);
}

function patchScope(options: PolicyOptions, file: string): { name?: string; vram?: string } {
  const match = normalizedPath(file).match(/^src\/(.+)\.c$/);
  const name = match ? match[1] : options.functionName;
  if (!name) return {};
  const vram = options.functionVrams?.[name]
    ?? (name === options.functionName ? options.functionVram : undefined);
  return { name, vram };
}

function scanAddedPatch(options: PolicyOptions): PolicyFinding[] {
  if (!options.patch) return [];
  const findings: PolicyFinding[] = [];
  let file = "";
  let scope: { name?: string; vram?: string } = {};
  let newLine = 0;
  for (const line of options.patch.split("\n")) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
      scope = patchScope(options, file);
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
      const violation = commentOnly || !policesConstructs(file)
        ? undefined
        : forbiddenLine(text, options.config, scope.name, scope.vram);
      if (violation) findings.push({ kind: violation.kind, file, line: newLine, message: violation.message, text: text.trim() });
      /* A CC1FLAGS_ line names the stem it overrides, so the allowlist lookup
       * keys on that stem rather than on the patch scope. The scope is empty
       * whenever the caller audits the repo rather than one function, and
       * keying on it there reported an allowlisted override as a violation. */
      const overrideStem = file === "configs/flag_overrides.mk"
        ? text.match(/^CC1FLAGS_(\S+?)\s*:?=/)?.[1]
        : undefined;
      if (overrideStem) {
        const overrideVram = options.functionVrams?.[overrideStem]
          ?? (overrideStem === options.functionName ? options.functionVram : undefined);
        if (!allowlisted(options.config, overrideStem, overrideVram, "flag-override")) {
          findings.push({
            kind: "flag-override",
            file,
            line: newLine,
            message: "New per-function compiler flag overrides are forbidden",
            text: text.trim(),
          });
        }
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
