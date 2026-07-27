import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { ROOT } from "../decompToolchain.js";
import type { ResolvedVariantHypothesis, ToolIdentity, VariantRunManifest, VariantRunSummary } from "./types.js";

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

export function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function writeStableJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableJson(value));
}

export function projectPath(path: string): string {
  if (!isAbsolute(path)) return path.replace(/\\/g, "/");
  const related = relative(ROOT, path).replace(/\\/g, "/");
  return related.startsWith("../") ? path : related;
}

export function variantLabImplementationHash(): string {
  const directory = join(ROOT, "tools/agent/variant-lab");
  const paths = [
    join(ROOT, "tools/agent/fuzzVariants.ts"),
    ...readdirSync(directory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort().map((name) => join(directory, name)),
  ];
  return sha256(paths.map((path) => `${relative(ROOT, path)}:${sha256File(path)}`).join("\n"));
}

export function deterministicRunId(options: {
  functionName: string;
  mode: "cc1-only" | "full";
  tracePasses: boolean;
  variants: ResolvedVariantHypothesis[];
  toolchain: ToolIdentity;
  compilerFlags?: string[];
}): string {
  const identity = {
    schemaVersion: 1,
    function: options.functionName,
    mode: options.mode,
    tracePasses: options.tracePasses,
    compilerFlags: options.compilerFlags || [],
    variants: options.variants.map(({ absoluteSourcePath: _absolute, ...variant }) => ({
      ...variant,
      sourcePath: projectPath(variant.sourcePath),
    })),
    toolchain: options.toolchain,
  };
  return sha256(stableJson(identity)).slice(0, 16);
}

export function preserveSource(source: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

export function hashDirectoryFiles(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) visit(path);
      else result[relative(directory, path).replace(/\\/g, "/")] = sha256File(path);
    }
  };
  visit(directory);
  return result;
}

export function writeRunManifest(runRoot: string, manifest: VariantRunManifest): void {
  writeStableJson(join(runRoot, "manifest.json"), manifest);
}

export function writeRunSummary(runRoot: string, summary: VariantRunSummary, text: string): void {
  writeStableJson(join(runRoot, "summary.json"), summary);
  writeFileSync(join(runRoot, "summary.txt"), text.endsWith("\n") ? text : `${text}\n`);
}
