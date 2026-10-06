import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildToolInputs } from "../../../../tools/build/buildInputs.js";
import { dependencyPaths } from "../../../../tools/agent/preprocessedCache.js";
import { digest, filesUnder, snapshot } from "../../../../tools/lib/contentCache.js";
import type { AutodecompConfig, GateResult } from "../../shared/types.ts";

export interface VerificationReceipt {
  schema: 1; workspace: string; functionName: string; inputHash: string; outputHash: string; configHash: string; checkedAt: string;
}
/** Receipts originate in this process's successful gate, never in agent prose
 * or a writable JSON claiming to have passed. Worktree/trunk gates don't share
 * this map. Scope/policy are checked anew even when all machine work is reused. */
const receipts = new Map<string, { receipt: VerificationReceipt; gate: GateResult }>();
const contextOnly = (p: string) => /include\/(?:functions\.h|sdk_types\.h|overlays\/[^/]+\.h)$/.test(p);
/** Verification concerns the configured linked images/objects, not the tens of
 * gigabytes of unrelated compiler experiments under build/. Derive the roots
 * from splat without using a process-global container cache or another root. */
function buildRoots(root: string): { directories: string[]; assembly: string[]; scripts: string[] } {
  const directories = new Set([join(root, "build")]), assembly = new Set([join(root, "build/asm")]), scripts = new Set<string>();
  const base = readFileSync(join(root, "Makefile"), "utf8").match(/^BASENAME\s*:=\s*(\S+)/m)?.[1];
  if (base) scripts.add(join(root, "build", base + ".ld"));
  for (const config of filesUnder(join(root, "configs/splat")).filter((p) => /\.ya?ml$/.test(p))) {
    const text = readFileSync(config, "utf8");
    const script = text.match(/^\s*ld_script_path:\s*(\S+)/m)?.[1];
    const asm = text.match(/^\s*asm_path:\s*(\S+)/m)?.[1];
    if (script) { directories.add(dirname(resolve(root, script))); scripts.add(resolve(root, script)); }
    if (asm) assembly.add(resolve(root, asm));
  }
  return { directories: [...directories], assembly: [...assembly], scripts: [...scripts] };
}
function directFiles(directory: string): string[] {
  return existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(directory, e.name)) : [];
}
export function compilerInputs(root: string, omitContext = false): string {
  const mk = readFileSync(join(root, "Makefile"), "utf8");
  const target = mk.match(/^TARGET\s*:=\s*(\S+)/m)?.[1];
  const paths = ["src", "lib", "extracted/overlays", ...(target ? [target] : []), "include", "configs", "tools/agent", "tools/build", "tools/lib", "tools/diagnostics", ".pi/extensions/psx-decomp", ".pi/extensions/shared", ".pi/autoloop.json",
    "tools/vendor/m2c/m2c", "tools/vendor/m2c/m2c_pycparser", "tools/vendor/m2c/m2c.py", "tools/vendor/tree-sitter-c", "package-lock.json",
    "build/engine_syms.txt", "build/callGraph.json", "build/toolchain-inputs.stamp", ...buildToolInputs(root)];
  const roots = buildRoots(root);
  const buildFiles = [...roots.scripts, ...roots.directories.flatMap(directFiles).filter((p) =>
    /\/(?:ld_includes|undefined_funcs_auto|undefined_syms_auto|engine_syms|dep_syms|lib_bss_syms|disassembler_symbol_addrs)\.txt$|\/(?:sectionLayout\.json|functions\.csv)$/.test(p))];
  paths.push(...buildFiles, ...roots.assembly);
  /* Follow actual linker INCLUDEs and non-rebuilt object inputs too. */
  const visited = new Set<string>();
  const linkInputs = (file: string): void => {
    if (visited.has(file) || !existsSync(file)) return;
    visited.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\bINCLUDE\s+["']?([^\s"';]+)/g)) {
      const included = resolve(root, m[1]!); paths.push(included); linkInputs(included);
    }
    for (const m of text.matchAll(/([\w./-]+\.o)\b/g)) {
      const object = resolve(root, m[1]!);
      if (!object.startsWith(join(root, "build/src") + "/") && !roots.assembly.some((p) => object.startsWith(p + "/"))) paths.push(object);
    }
  };
  for (const file of buildFiles.filter((p) => p.endsWith(".ld"))) linkInputs(file);
  const dependencies = filesUnder(join(root, "build/src")).filter((p) => p.endsWith(".d"));
  for (const dep of dependencies) {
    paths.push(...dependencyPaths(readFileSync(dep, "utf8"), root));
  }
  return digest(JSON.stringify(snapshot(root, paths.filter((p) => !(omitContext && contextOnly(p))),
    (p) => (!roots.assembly.some((a) => p.startsWith(a + "/")) || p.endsWith(".s")) && !p.endsWith(".test.ts") && !p.endsWith(".pyc") && !p.includes("/__pycache__/") && !p.endsWith("configs/project-profile.md") && !(omitContext && contextOnly(p)))));
}
export function contextIsCompilerIndependent(root: string): boolean {
  for (const source of filesUnder(join(root, "src")).filter((p) => p.endsWith(".c"))) {
    const dep = join(root, "build", source.slice(root.length + 1) + ".o.d");
    if (!existsSync(dep)) return false;
    const text = readFileSync(dep, "utf8");
    if (/include\/(?:functions\.h|sdk_types\.h|overlays\/[^\s]+\.h)/.test(text)) return false;
  }
  return true;
}
export function verificationOutputs(root: string, functionName?: string): string {
  const roots = buildRoots(root);
  const images = roots.scripts.flatMap((p) => [p.replace(/\.ld$/, ".bin"), p.replace(/\.ld$/, ".elf")]);
  const paths = [join(root, "build/src"), ...roots.assembly, ...images,
    ...(functionName ? [join(root, "build/diffFunc", functionName + ".c.o")] : [])];
  return digest(JSON.stringify(snapshot(root, paths, (p) => /(?:\.bin|\.elf|\.o|\.o\.d)$/.test(p))));
}
const keyOf = (root: string, name: string) => `${resolve(root)}:${name}`;
export function publishReceipt(root: string, name: string, config: AutodecompConfig, gate: GateResult): VerificationReceipt {
  if (!gate.pass || !gate.diff?.exact || gate.build?.code !== 0) throw new Error("Cannot receipt an incomplete verification");
  const receipt: VerificationReceipt = { schema: 1, workspace: resolve(root), functionName: name, inputHash: compilerInputs(root),
    outputHash: verificationOutputs(root, name), configHash: digest(JSON.stringify(config)), checkedAt: gate.checkedAt };
  receipts.set(keyOf(root, name), { receipt, gate: structuredClone({ ...gate, receipt }) });
  return receipt;
}
export function consumeReceipt(root: string, name: string, config: AutodecompConfig): { gate?: GateResult; reason: string } {
  const stored = receipts.get(keyOf(root, name));
  if (!stored) return { reason: "no successful same-workspace receipt" };
  if (stored.receipt.configHash !== digest(JSON.stringify(config))) return { reason: "gate configuration changed" };
  if (stored.receipt.inputHash !== compilerInputs(root)) return { reason: "verification inputs or membership changed" };
  if (stored.receipt.outputHash !== verificationOutputs(root, name)) return { reason: "verified outputs changed" };
  return { gate: structuredClone(stored.gate), reason: "same-workspace inputs and outputs unchanged" };
}
