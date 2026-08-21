/**
 * disassemble.ts — run spimdisasm over every container.
 *
 * Deliverable 6 of plans/overlay-decompilation-enablement.md. The shell script
 * this replaces hardcoded one binary, one start offset, one load address, one
 * gp value and one output prefix; all five are container facts now.
 *
 * Two passes per container, and the second is mandatory rather than
 * incidental. With `--disasm-unknown` spimdisasm invents multi-kilobyte phantom
 * "functions" inside data regions, which breaks the boundary inference that
 * `analyzeLayout.ts` does. Overlay members are roughly half data by volume, so
 * that failure is worse for them than it is for the PS-X EXE.
 *
 * Usage:
 *   npx tsx tools/build/disassemble.ts                    # every container
 *   npx tsx tools/build/disassemble.ts --container ovl_11 # one container
 *   npx tsx tools/build/disassemble.ts --overlays         # every overlay
 */

import { execFileSync, execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import {
  containerPath,
  containerTargetPath,
  loadContainers,
  requireContainer,
  unresolvedCodeMembers,
  type Container,
} from "../lib/container.js";

const args = process.argv.slice(2);
const containerIdx = args.indexOf("--container");
const only = containerIdx >= 0 ? args[containerIdx + 1] : undefined;
const overlaysOnly = args.includes("--overlays");

function selected(): Container[] {
  if (only) return [requireContainer(only)];
  const all = loadContainers();
  return overlaysOnly ? all.filter((c) => c.kind === "overlay") : all;
}

function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

/**
 * The address -> name table handed to the disassembler.
 *
 * For the PS-X EXE this is `genDisasmSymbols.ts`, which carries the project's
 * curated names. An overlay has no curated table on a cold start, so it starts
 * from whatever its own symbol file already holds — nothing on the first run.
 */
function prepareSymbolTable(container: Container): string | null {
  if (container.kind === "exe") {
    execSync("npx tsx tools/build/genDisasmSymbols.ts --write", { cwd: ROOT, stdio: "inherit" });
    return container.paths.disasmSymbolAddrs;
  }
  const symbols = containerPath(container, "symbolAddrs");
  return existsSync(symbols) ? container.paths.symbolAddrs : null;
}

function runSpimdisasm(container: Container, outDir: string, options: { unknown: boolean }): void {
  mkdirSync(join(ROOT, outDir), { recursive: true });
  const symbolTable = prepareSymbolTable(container);

  const argv = [
    "singleFileDisasm",
    "--arch-level",
    "MIPS1",
    ...(options.unknown ? ["--disasm-unknown"] : []),
    container.targetPath,
    outDir,
    "--start",
    hex(container.payloadOffset),
    "--vram",
    hex(container.loadAddr),
    "--instr-category",
    "r3000gte",
    ...(options.unknown ? ["--split-functions", container.paths.functionsDir] : []),
    "--function-info",
    options.unknown ? container.paths.functionsCsv : container.paths.layoutCsv,
    "--compiler",
    "PSYQ",
    "--endian",
    "little",
    ...(container.gpValue !== 0 ? ["--gp", hex(container.gpValue)] : []),
    ...(symbolTable ? ["--symbol-addrs", symbolTable] : []),
  ];

  execFileSync("spimdisasm", argv, { cwd: ROOT, stdio: "inherit" });

  /* spimdisasm writes a whole-section `.text.s` beside the per-function dump.
     Nothing downstream reads it and it is large, so it goes. */
  const dir = join(ROOT, outDir);
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".text.s")) rmSync(join(dir, entry));
  }
}

const containers = selected();
for (const container of containers) {
  console.log(`=== ${container.id}: ${container.targetPath} at ${hex(container.loadAddr)} ===`);
  runSpimdisasm(container, container.paths.disasmDir, { unknown: true });
  runSpimdisasm(container, `${container.paths.disasmDir}/without-unknown`, { unknown: false });
  console.log(`${container.id}: disassembly complete`);
}

const unresolved = unresolvedCodeMembers();
if (unresolved.length > 0 && !only) {
  console.log();
  console.log(
    `NOT DISASSEMBLED — ${unresolved.length} code member(s) have no solved base: ${unresolved.map((m) => m.id).join(", ")}`
  );
  console.log("  An undetermined base is work to finish, not a member to drop.");
  console.log("  Run: npx tsx tools/build/solveOverlayBase.ts --verbose");
}
