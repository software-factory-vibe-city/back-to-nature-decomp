/**
 * bootstrapOverlay.ts — generate an overlay container's configs from scratch.
 *
 * Deliverables 6 and 7 of plans/overlay-decompilation-enablement.md. The PS-X
 * EXE's bootstrap reads a header for its geometry and lets the disassembler
 * infer section boundaries; an overlay member has no header, so its base comes
 * from the Deliverable 3 solver and its boundaries from `overlayLayout.ts`.
 *
 * The disassembler is then run over the derived `.text` range only. Run over
 * the whole member it collapses everything into one multi-kilobyte phantom
 * function, because a member that opens with data gives it nothing to anchor
 * on — the same failure the PS-X EXE's two-pass disassembly exists to avoid,
 * worse here because overlay members are roughly half data by volume.
 *
 * Usage:
 *   npx tsx tools/build/bootstrapOverlay.ts                    # every overlay
 *   npx tsx tools/build/bootstrapOverlay.ts --container ovl_11
 *   npx tsx tools/build/bootstrapOverlay.ts --write            # write configs
 */

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import {
  containerPath,
  containerTargetPath,
  loadContainers,
  requireContainer,
  symbolPrefix,
  unresolvedCodeMembers,
  type Container,
} from "../lib/container.js";
import { requireManifest, readMemberBytes } from "../lib/overlayManifest.js";
import type { OverlayLayout } from "../lib/overlayLayout.js";
import { deriveLayoutByStrategy, layoutFromConsensus } from "../lib/overlayStrategies.js";
import { detectToolchain } from "../lib/toolchainProfile.js";
import { collectSelfReferences } from "../lib/overlayBase.js";
import { ENGINE_EXPORT_PATH } from "../lib/symbolIndex.js";
import { loadPsxExeInfo } from "../lib/psxExeInfo.js";
import { parseCSV } from "./analyzeLayout.js";

const args = process.argv.slice(2);
const write = args.includes("--write");
const containerIdx = args.indexOf("--container");
const only = containerIdx >= 0 ? args[containerIdx + 1] : undefined;

const manifest = requireManifest();
const profile = detectToolchain();
const exeInfo = loadPsxExeInfo();
const exeImage = { start: exeInfo.loadAddr, end: exeInfo.loadAddr + exeInfo.payloadSize };

const containers = only
  ? [requireContainer(only)]
  : loadContainers().filter((container) => container.kind === "overlay");

function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

function ensureDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

/**
 * The address -> name table the disassembler reads.
 *
 * Engine symbols go in so a call out of the overlay is rendered by name rather
 * than as a bare address; the overlay's own functions go in so they carry the
 * container prefix that makes `(container, vram)` one token.
 */
function writeDisasmSymbols(container: Container, ownFunctions: readonly number[]): void {
  const enginePath = join(ROOT, ENGINE_EXPORT_PATH);
  const engineLines: string[] = [];
  if (existsSync(enginePath)) {
    for (const line of readFileSync(enginePath, "utf-8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0x[0-9A-Fa-f]+)\s*;/);
      if (match) engineLines.push(`${match[1]} = ${match[2]};`);
    }
  }
  const own = ownFunctions.map(
    (address) => `${symbolPrefix(container)}func_${address.toString(16).toUpperCase()} = ${hex(address)}; // type:func`
  );
  const path = containerPath(container, "disasmSymbolAddrs");
  ensureDir(path);
  writeFileSync(path, [...engineLines, ...own].join("\n") + "\n");
}

function runSpimdisasm(
  container: Container,
  layout: OverlayLayout,
  outDir: string,
  options: { unknown: boolean; csv: string; splitFunctions?: string }
): void {
  mkdirSync(join(ROOT, outDir), { recursive: true });
  const argv = [
    "singleFileDisasm",
    "--arch-level",
    "MIPS1",
    ...(options.unknown ? ["--disasm-unknown"] : []),
    container.targetPath,
    outDir,
    "--start",
    hex(layout.textStart),
    "--end",
    hex(layout.dataStart),
    "--vram",
    hex(container.loadAddr + layout.textStart),
    "--instr-category",
    "r3000gte",
    ...(options.splitFunctions ? ["--split-functions", options.splitFunctions] : []),
    "--function-info",
    options.csv,
    "--compiler",
    "PSYQ",
    "--endian",
    "little",
    "--symbol-addrs",
    container.paths.disasmSymbolAddrs,
  ];
  execFileSync("spimdisasm", argv, { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });

  const dir = join(ROOT, outDir);
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".text.s")) rmSync(join(dir, entry));
  }
}

function sha1Of(path: string): string {
  return createHash("sha1").update(readFileSync(path)).digest("hex");
}

/**
 * Symbol files this container must read besides its own.
 *
 * The engine export always. And the symbol file of any overlay in a *different*
 * slot whose extent this member's own `jal`/`j` targets land in: cross-overlay
 * calls are real — ovl_30 calls ten functions inside ovl_11 — and without the
 * callee's symbol file splat renders those calls as anonymous addresses and the
 * call graph loses the edge. Slot mates are excluded because two members at one
 * base are never resident together, so one can never call the other.
 */
function crossSlotSymbolFiles(container: Container, bytes: Buffer): string[] {
  const refs = collectSelfReferences({ id: container.id, bytes, exeImage });
  const targets = [...refs.calls, ...refs.jumps];
  const files: string[] = [];
  for (const other of loadContainers()) {
    if (other.kind !== "overlay" || other.id === container.id) continue;
    if (other.loadAddr === container.loadAddr) continue;
    const hit = targets.some(
      (target) => target >= other.loadAddr && target < other.loadAddr + other.payloadSize
    );
    if (hit) files.push(other.paths.symbolAddrs);
  }
  return files;
}

function renderSplatConfig(
  container: Container,
  layout: OverlayLayout,
  functions: Array<{ address: number; name: string }>,
  crossSlot: readonly string[]
): string {
  const indent = "      ";
  const subsegments: string[] = [];

  /* Section order is PSYLINK's, the same order the PS-X EXE was linked with:
     read-only data, then code, then writable data. */
  subsegments.push(`${indent}- [${hex(layout.rodataStart)}, rodata]`);
  for (const fn of functions) {
    const rom = fn.address - container.loadAddr;
    subsegments.push(`${indent}- [${hex(rom)}, c, ${fn.name}]`);
  }
  subsegments.push(`${indent}- [${hex(layout.dataStart)}, data]`);

  return [
    `name: ${container.id}`,
    `sha1: ${sha1Of(containerTargetPath(container))}`,
    "options:",
    "  platform: psx",
    "  compiler: GCC",
    `  basename: ${container.basename}`,
    "  base_path: ../..",
    /* Objects mirror sources under build/, exactly as the PS-X EXE's do, so one
       compile rule covers every container. splat composes an object path as
       build_path + src_path, so build_path stays "build" and the container
       shows up in src_path. */
    "  build_path: build",
    `  ld_script_path: ${container.paths.ldScript}`,
    `  target_path: ${container.targetPath}`,
    `  asm_path: ${container.paths.asmDir}`,
    `  src_path: ${container.paths.srcDir}`,
    "  asset_path: assets",
    "  symbol_addrs_path:",
    `    - ${container.paths.symbolAddrs}`,
    `    - ${ENGINE_EXPORT_PATH}`,
    ...crossSlot.map((path) => `    - ${path}`),
    `  undefined_funcs_auto_path: ${container.paths.undefinedFuncs}`,
    `  undefined_syms_auto_path: ${container.paths.undefinedSyms}`,
    "  find_file_boundaries: false",
    "  disasm_unknown: true",
    '  section_order: [".rodata", ".text", ".data", ".sdata", ".sbss", ".bss"]',
    "  extensions_path: tools/vendor/splat_ext",
    "  subalign: 4",
    "",
    "segments:",
    `  - name: ${container.id}`,
    "    type: code",
    `    start: ${hex(0)}`,
    `    vram: ${hex(container.loadAddr)}`,
    "    align: 4",
    "    subalign: 4",
    "    subsegments:",
    ...subsegments,
    `  - [${hex(layout.fileEnd)}]`,
    "",
  ].join("\n");
}

/**
 * A container's own symbols as bare linker-script assignments.
 *
 * `configs/symbols/<id>.txt` is splat's format and carries `//` attribute
 * comments, which GNU ld's script parser rejects. A cross-slot caller needs
 * *definitions* for the functions it calls in the other overlay, so the same
 * facts are re-emitted in the one syntax the linker reads — the same mechanism
 * Deliverable 8 uses for the engine.
 */
function writeExports(container: Container): void {
  const symbols = containerPath(container, "symbolAddrs");
  if (!existsSync(symbols)) return;
  const lines: string[] = [];
  for (const line of readFileSync(symbols, "utf-8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0x[0-9A-Fa-f]+)\s*;/);
    if (match) lines.push(`${match[1]} = ${match[2]};`);
  }
  const path = join(ROOT, container.paths.disasmDir, "exports.txt");
  ensureDir(path);
  writeFileSync(path, lines.join("\n") + "\n");
}

/* Every container's exports, so a single-container split still finds the
   cross-slot definitions it needs. */
for (const container of loadContainers()) writeExports(container);

let failures = 0;

for (const container of containers) {
  const member = manifest.members.find((m) => m.id === container.id);
  if (!member) {
    console.error(`${container.id}: no manifest member`);
    failures++;
    continue;
  }

  const bytes = readMemberBytes(manifest, member);
  const consensus = deriveLayoutByStrategy(
    { id: container.id, bytes, exeImage },
    profile,
    container.loadAddr
  );
  const layout = layoutFromConsensus(consensus, bytes.length);

  console.log(`=== ${container.id} — ${bytes.length} bytes at ${hex(container.loadAddr)} ===`);
  for (const line of layout.evidence) console.log(`  ${line}`);
  console.log(
    `  .rodata ${hex(layout.rodataStart)}..${hex(layout.textStart)}  ` +
      `.text ${hex(layout.textStart)}..${hex(layout.dataStart)}  ` +
      `.data ${hex(layout.dataStart)}..${hex(layout.fileEnd)}`
  );
  for (const residual of layout.residuals) console.log(`  residual: ${residual}`);

  if (layout.textStart >= layout.dataStart) {
    console.error(`  ${container.id}: no code region derived; refusing to write a config`);
    failures++;
    continue;
  }

  /* First pass names only the engine, so the function list it produces is the
     disassembler's own boundary analysis rather than an echo of our seeds. */
  writeDisasmSymbols(container, []);
  runSpimdisasm(container, layout, container.paths.disasmDir, {
    unknown: true,
    csv: container.paths.functionsCsv,
    splitFunctions: container.paths.functionsDir,
  });

  const entries = parseCSV(containerPath(container, "functionsCsv"));
  const functions = entries
    .filter((entry) => entry.address >= container.loadAddr + layout.textStart)
    .filter((entry) => entry.address < container.loadAddr + layout.dataStart)
    .sort((a, b) => a.address - b.address)
    .map((entry) => ({
      address: entry.address,
      name: `${symbolPrefix(container)}func_${entry.address.toString(16).toUpperCase()}`,
    }));

  console.log(`  ${functions.length} functions in .text`);

  /* Second pass, now with the container's own names, plus the pass without
     --disasm-unknown that boundary analysis downstream reads. */
  writeDisasmSymbols(container, functions.map((f) => f.address));
  runSpimdisasm(container, layout, container.paths.disasmDir, {
    unknown: true,
    csv: container.paths.functionsCsv,
    splitFunctions: container.paths.functionsDir,
  });
  runSpimdisasm(container, layout, `${container.paths.disasmDir}/without-unknown`, {
    unknown: false,
    csv: container.paths.layoutCsv,
  });

  if (!write) {
    console.log(`  (dry run — pass --write to publish ${container.paths.splat})`);
    continue;
  }

  const layoutPath = containerPath(container, "sectionLayout");
  ensureDir(layoutPath);
  writeFileSync(
    layoutPath,
    JSON.stringify(
      {
        rodataStart: layout.rodataStart,
        textStart: layout.textStart,
        dataStart: layout.dataStart,
        sdataStart: layout.fileEnd,
        fileEnd: layout.fileEnd,
        evidence: layout.evidence,
        residuals: layout.residuals,
      },
      null,
      2
    ) + "\n"
  );

  const symbolsPath = containerPath(container, "symbolAddrs");
  ensureDir(symbolsPath);
  writeFileSync(
    symbolsPath,
    functions.map((fn) => `${fn.name} = ${hex(fn.address)}; // type:func`).join("\n") + "\n"
  );

  const splatPath = containerPath(container, "splat");
  ensureDir(splatPath);
  const crossSlot = crossSlotSymbolFiles(container, bytes).filter((path) => existsSync(join(ROOT, path)));
  if (crossSlot.length > 0) {
    console.log(`  cross-slot symbol files: ${crossSlot.join(", ")}`);
  }
  writeFileSync(splatPath, renderSplatConfig(container, layout, functions, crossSlot));

  mkdirSync(containerPath(container, "srcDir"), { recursive: true });
  writeExports(container);

  /* The linker-script tail this container's link needs: splat's own undefined
     tables, plus a definition file for every overlay in another slot it calls
     into. Written rather than hardcoded in the Makefile so the dependency is
     derived from the member's own references. */
  const includes = [
    `INCLUDE "${container.paths.undefinedFuncs}"`,
    `INCLUDE "${container.paths.undefinedSyms}"`,
    ...crossSlot.map((path) => {
      const other = loadContainers().find((c) => c.paths.symbolAddrs === path)!;
      return `INCLUDE "${other.paths.disasmDir}/exports.txt"`;
    }),
  ];
  const includesPath = join(ROOT, container.paths.disasmDir, "ld_includes.txt");
  ensureDir(includesPath);
  writeFileSync(includesPath, includes.join("\n") + "\n");

  console.log(`  wrote ${container.paths.splat}, ${container.paths.symbolAddrs}, ${container.paths.sectionLayout}`);
}

const unresolved = unresolvedCodeMembers();
if (unresolved.length > 0 && !only) {
  console.log();
  console.log(`NOT BOOTSTRAPPED — no solved base: ${unresolved.map((m) => m.id).join(", ")}`);
}

process.exit(failures > 0 ? 1 : 0);
