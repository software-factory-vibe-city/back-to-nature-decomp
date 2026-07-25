/**
 * bootstrap.ts — Generate configs from scratch for PSX decompilation
 *
 * Runs as the first step of `make split`. No-op when configs already exist
 * (symbol_addrs.txt has >1 line AND splat.yaml has subsegments).
 *
 * When configs are empty:
 * 1. Parse PSX-EXE header via psxExeInfo.ts
 * 2. Write disassembler_symbol_addrs.txt (just __start)
 * 3. Run spimdisasm to produce build/functions.csv
 * 4. Analyze layout to find section boundaries → build/sectionLayout.json
 * 5. Generate symbol_addrs.txt from functions.csv
 * 6. Generate splat.yaml subsegments
 *
 * Always regenerates build/sectionLayout.json for downstream tools.
 *
 * Usage:
 *   npx tsx tools/build/bootstrap.ts           # dry run
 *   npx tsx tools/build/bootstrap.ts --write   # write configs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import {
  loadPsxExeInfo,
  ROOT,
  type PsxExeInfo,
  type SectionLayout,
} from "../lib/psxExeInfo.ts";
import {
  classifyEntries,
  inferSectionBoundaries,
  parseCSV,
} from "./analyzeLayout.ts";

const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SYMBOL_ADDRS = join(ROOT, "configs/symbol_addrs.txt");
const DISASM_SYMBOL_ADDRS = join(ROOT, "configs/disassembler_symbol_addrs.txt");
const LAYOUT_PATH = join(ROOT, "build/sectionLayout.json");
const FUNCTIONS_CSV = join(ROOT, "build/functions.csv");

function romHex(rom: number): string {
  return `0x${rom.toString(16).toUpperCase()}`;
}

/** Check if configs need bootstrapping */
function needsBootstrap(): boolean {
  // Check symbol_addrs.txt
  if (!existsSync(SYMBOL_ADDRS) || statSync(SYMBOL_ADDRS).size <= 1) {
    return true;
  }
  const symContent = readFileSync(SYMBOL_ADDRS, "utf-8").trim();
  if (symContent.split("\n").length <= 1) return true;

  // Check splat.yaml has subsegments with c entries
  const yamlContent = readFileSync(SPLAT_YAML, "utf-8");
  if (!yamlContent.includes(", c, ")) return true;

  return false;
}

/** Write disassembler_symbol_addrs.txt with just __start */
function writeDisasmSymAddrs(info: PsxExeInfo, writeMode: boolean): void {
  const content = `__start = 0x${info.entryPoint.toString(16).toUpperCase()}; // type:func\n`;
  if (writeMode) {
    writeFileSync(DISASM_SYMBOL_ADDRS, content);
    console.log(`Wrote ${DISASM_SYMBOL_ADDRS}`);
  } else {
    console.log(`Would write ${DISASM_SYMBOL_ADDRS}`);
  }
}

/** Run spimdisasm to produce functions.csv */
function runDisassembler(info: PsxExeInfo): void {
  mkdirSync(join(ROOT, "build"), { recursive: true });

  const gpHex = `0x${info.gpValue.toString(16).toUpperCase()}`;
  const cmd = [
    "spimdisasm singleFileDisasm",
    "--arch-level MIPS1",
    "--disasm-unknown",
    info.binaryPath,
    "build",
    `--start 0x${info.payloadOffset.toString(16)}`,
    `--vram 0x${info.loadAddr.toString(16).toUpperCase()}`,
    "--instr-category r3000gte",
    "--split-functions build/functions",
    "--function-info build/functions.csv",
    "--compiler PSYQ",
    "--endian little",
    `--gp ${gpHex}`,
    `--symbol-addrs ${DISASM_SYMBOL_ADDRS}`,
  ].join(" \\\n  ");

  console.log("Running spimdisasm...");
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  // Clean up text files that we don't need
  execSync("rm -f build/slus_011_*.text.s", { cwd: ROOT });
  console.log("Disassembly complete");
}

/** Analyze layout and write sectionLayout.json */
function analyzeAndWriteLayout(info: PsxExeInfo, writeMode: boolean): SectionLayout {
  if (!existsSync(FUNCTIONS_CSV)) {
    throw new Error(`${FUNCTIONS_CSV} not found. Run disassembler first.`);
  }

  const binary = readFileSync(info.binaryPath);
  const results = classifyEntries(
    FUNCTIONS_CSV,
    binary,
    info.loadAddr,
    info.payloadOffset,
    info.payloadSize,
  );

  const boundaries = inferSectionBoundaries(results, info);
  const layout: SectionLayout = {
    rodataStart: boundaries.rodataStart,
    textStart: boundaries.textStart,
    dataStart: boundaries.dataStart,
    sdataStart: boundaries.sdataStart,
    fileEnd: boundaries.fileEnd,
  };

  if (writeMode) {
    mkdirSync(join(ROOT, "build"), { recursive: true });
    writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2) + "\n");
    console.log(`Wrote ${LAYOUT_PATH}`);
  }

  console.log(`Section layout: rodata=${romHex(layout.rodataStart)} text=${romHex(layout.textStart)} data=${romHex(layout.dataStart)} sdata=${romHex(layout.sdataStart)} end=${romHex(layout.fileEnd)}`);
  return layout;
}

/** Generate symbol_addrs.txt from functions.csv */
function generateSymbolAddrs(info: PsxExeInfo, layout: SectionLayout, writeMode: boolean): void {
  const entries = parseCSV(FUNCTIONS_CSV);

  // Filter to text range functions
  const textVramStart = layout.textStart - info.payloadOffset + info.loadAddr;
  const textVramEnd = layout.dataStart - info.payloadOffset + info.loadAddr;

  const lines: string[] = [];

  for (const e of entries) {
    if (e.address >= textVramStart && e.address < textVramEnd) {
      // Use func_XXXX naming
      const name = e.name.startsWith("func_") || e.name === "__start"
        ? e.name
        : `func_${e.address.toString(16).toUpperCase()}`;
      lines.push(`${name} = 0x${e.address.toString(16).toUpperCase()}; // type:func`);
    }
  }

  // Ensure __start is included
  const entryHex = info.entryPoint.toString(16).toUpperCase();
  if (!lines.some(l => l.includes("__start"))) {
    lines.unshift(`__start = 0x${entryHex}; // type:func`);
  }

  const content = lines.join("\n") + "\n";
  if (writeMode) {
    writeFileSync(SYMBOL_ADDRS, content);
    console.log(`Wrote ${SYMBOL_ADDRS} with ${lines.length} entries`);
  } else {
    console.log(`Would write ${lines.length} entries to ${SYMBOL_ADDRS}`);
  }
}

/** Generate splat.yaml subsegments from functions.csv + layout */
function generateSplatSubsegments(info: PsxExeInfo, layout: SectionLayout, writeMode: boolean): void {
  const yamlContent = readFileSync(SPLAT_YAML, "utf-8");
  const yamlLines = yamlContent.split("\n");

  // Find the subsegments line
  const subsegIdx = yamlLines.findIndex(l => l.trim() === "subsegments:");
  if (subsegIdx === -1) {
    console.error("Could not find 'subsegments:' in splat.yaml");
    return;
  }

  // Keep everything up to and including "subsegments:"
  const header = yamlLines.slice(0, subsegIdx + 1);

  // Parse functions.csv for text entries
  const entries = parseCSV(FUNCTIONS_CSV);
  const textVramStart = layout.textStart - info.payloadOffset + info.loadAddr;
  const textVramEnd = layout.dataStart - info.payloadOffset + info.loadAddr;
  const textFunctions = entries
    .filter(e => e.address >= textVramStart && e.address < textVramEnd)
    .sort((a, b) => a.address - b.address);

  // Build subsegment lines
  const subsegments: string[] = [];
  const indent = "      ";

  // rodata section
  subsegments.push(`${indent}- [${romHex(layout.rodataStart)}, rodata]`);

  // Per-function c entries in text section
  for (const func of textFunctions) {
    const rom = func.address - info.loadAddr + info.payloadOffset;
    const name = func.name.startsWith("func_") || func.name === "__start"
      ? func.name
      : `func_${func.address.toString(16).toUpperCase()}`;
    subsegments.push(`${indent}- [${romHex(rom)}, c, ${name}]`);
  }

  // data section
  subsegments.push(`${indent}- [${romHex(layout.dataStart)}, data]`);

  // sdata section
  subsegments.push(`${indent}- [${romHex(layout.sdataStart)}, sdata]`);

  // End marker (top-level, 2-space indent)
  subsegments.push(`  - [${romHex(layout.fileEnd)}]`);

  const newContent = [...header, ...subsegments].join("\n") + "\n";

  if (writeMode) {
    writeFileSync(SPLAT_YAML, newContent);
    console.log(`Wrote splat.yaml with ${textFunctions.length} c entries`);
  } else {
    console.log(`Would write splat.yaml with ${textFunctions.length} c entries`);
  }
}

/** Infer layout from existing splat.yaml subsegments when functions.csv is unavailable.
 *
 * We need the *base* section boundaries (before library adjustment) since tools
 * like patchSplatForLibs dynamically adjust boundaries when library .text extends
 * past them. The text start is determined from the first c/o entry (not rodata).
 * The data/sdata starts come from finding the last c/o entry in text region and
 * the GP range for sdata.
 */
function inferLayoutFromYaml(info: PsxExeInfo): SectionLayout {
  const yamlContent = readFileSync(SPLAT_YAML, "utf-8");
  let rodataStart = info.payloadOffset;
  let textStart = info.payloadOffset;

  // Find first c entry = text start (o entries before first c are rodata)
  const cMatch = yamlContent.match(/- \[(0x[0-9A-Fa-f]+),\s*c,/);
  if (cMatch) textStart = parseInt(cMatch[1], 16);

  // Find data/sdata boundaries by looking at all subsegment entries.
  // Walk all entries: last c/o before data = end of text = data start.
  // Use GP range to determine sdata boundary.
  const segRe = /- \[(0x[0-9A-Fa-f]+),\s*(rodata|c|o|data|sdata)/g;
  let lastTextRom = textStart;
  let firstDataRom = info.fileEnd;
  let firstSdataRom = info.fileEnd;
  let seenData = false;

  let m;
  while ((m = segRe.exec(yamlContent)) !== null) {
    const rom = parseInt(m[1], 16);
    const type = m[2];
    if (type === "c" || (type === "o" && rom >= textStart && rom < firstDataRom)) {
      if (!seenData) lastTextRom = rom;
    }
    if (type === "data" && !seenData) {
      firstDataRom = rom;
      seenData = true;
    }
    if (type === "sdata" && firstSdataRom === info.fileEnd) {
      firstSdataRom = rom;
    }
  }

  return {
    rodataStart,
    textStart,
    dataStart: firstDataRom,
    sdataStart: firstSdataRom,
    fileEnd: info.fileEnd,
  };
}

function main() {
  const writeMode = process.argv.includes("--write");
  const forceMode = process.argv.includes("--force");

  const info = loadPsxExeInfo();
  console.log(`PSX-EXE: load=0x${info.loadAddr.toString(16)} entry=0x${info.entryPoint.toString(16)} payload=${info.payloadSize} GP=0x${info.gpValue.toString(16)}`);

  const bootstrap = forceMode || needsBootstrap();

  if (bootstrap) {
    console.log("\nBootstrapping configs from binary...");

    // Step 1: Write disassembler_symbol_addrs.txt
    writeDisasmSymAddrs(info, writeMode);

    // Step 2: Run spimdisasm (only if functions.csv doesn't exist)
    if (!existsSync(FUNCTIONS_CSV)) {
      if (writeMode) {
        runDisassembler(info);
      } else {
        console.log("Would run spimdisasm (dry run, skipping)");
      }
    }

    // Step 3: Analyze layout → sectionLayout.json
    if (existsSync(FUNCTIONS_CSV)) {
      const layout = analyzeAndWriteLayout(info, writeMode);

      // Step 4: Generate symbol_addrs.txt
      generateSymbolAddrs(info, layout, writeMode);

      // Step 5: Generate splat.yaml subsegments
      generateSplatSubsegments(info, layout, writeMode);
    }
  } else {
    console.log("\nConfigs already exist, skipping bootstrap.");

    // Always regenerate sectionLayout.json for downstream tools
    if (existsSync(FUNCTIONS_CSV)) {
      analyzeAndWriteLayout(info, writeMode);
    } else if (!existsSync(LAYOUT_PATH)) {
      // No functions.csv and no layout — infer from splat.yaml subsegments
      console.log("No functions.csv — inferring layout from splat.yaml subsegments.");
      const layout = inferLayoutFromYaml(info);
      if (writeMode) {
        mkdirSync(join(ROOT, "build"), { recursive: true });
        writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2) + "\n");
        console.log(`Wrote ${LAYOUT_PATH}`);
      }
      console.log(`Section layout: rodata=${romHex(layout.rodataStart)} text=${romHex(layout.textStart)} data=${romHex(layout.dataStart)} sdata=${romHex(layout.sdataStart)} end=${romHex(layout.fileEnd)}`);
    } else {
      console.log("sectionLayout.json already exists.");
    }
  }

  if (!writeMode) {
    console.log("\nDry run. Run with --write to apply changes.");
  }
}

main();
