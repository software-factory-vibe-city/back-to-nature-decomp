import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { implementationHash, projectPath, sha256, sha256File, stableJson, writeStableJson } from "../provenance.js";
import type { ResolvedVariantHypothesis, ToolIdentity, VariantRunManifest, VariantRunSummary } from "./types.js";

/* The hashing and stable-JSON primitives live in ../provenance.ts, which owns
 * artifact freshness for every tool. They are re-exported here so this module's
 * existing callers keep their import site. */
export { projectPath, sha256, sha256File, stableJson, stableValue, writeStableJson } from "../provenance.js";

export function variantLabImplementationHash(): string {
  return implementationHash([
    join(ROOT, "tools/agent/fuzzVariants.ts"),
    join(ROOT, "tools/agent/variant-lab"),
  ]);
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
