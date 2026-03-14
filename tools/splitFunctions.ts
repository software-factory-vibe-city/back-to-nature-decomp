/**
 * splitFunctions.ts
 *
 * Reads spimdisasm's functions.csv, filters to functions in the .text range,
 * and replaces the single `asm` subsegment in splat.yaml with
 * per-function asm entries.
 *
 * Also generates the initial configs/symbol_addrs.txt if it doesn't exist
 * or is empty.
 *
 * Usage:
 *   npx tsx tools/splitFunctions.ts           # dry run, prints diff
 *   npx tsx tools/splitFunctions.ts --write   # modifies splat.yaml
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, requireSectionLayout, ROOT } from "./psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const _layout = requireSectionLayout();
const CSV_PATH = join(ROOT, "build/functions.csv");
const SPLAT_PATH = join(ROOT, "configs/splat.yaml");
const SYMBOLS_PATH = join(ROOT, "configs/symbol_addrs.txt");

// .text section boundaries (vram)
const TEXT_START = _layout.textStart - _info.payloadOffset + _info.loadAddr;
const TEXT_END = _layout.dataStart - _info.payloadOffset + _info.loadAddr;

// Convert vram address to file offset
const LOAD_ADDR = _info.loadAddr;
const HEADER_SIZE = _info.payloadOffset;
const vramToOffset = (vram: number) => vram - LOAD_ADDR + HEADER_SIZE;

// Parse functions.csv
const csv = readFileSync(CSV_PATH, "utf-8");
const lines = csv.split("\n").filter((l) => l.trim());
const header = lines[0].split(",");
const nameIdx = header.indexOf("name");
const addrIdx = header.indexOf("address");

if (nameIdx === -1 || addrIdx === -1) {
  console.error("ERROR: Could not find 'name' and 'address' columns in CSV.");
  console.error(`Header: ${lines[0]}`);
  process.exit(1);
}

const allFunctions = lines
  .slice(1)
  .map((line) => {
    const cols = line.split(",");
    const addr = cols[addrIdx];
    return { name: cols[nameIdx], vram: parseInt(addr, 16) };
  })
  .filter((e) => e.name && !isNaN(e.vram))
  .sort((a, b) => a.vram - b.vram);

const textFunctions = allFunctions.filter(
  (s) => s.vram >= TEXT_START && s.vram < TEXT_END
);

console.log(
  `Parsed ${allFunctions.length} functions from CSV, ${textFunctions.length} in .text range`
);

// Generate subsegment lines for splat.yaml
const subsegmentLines = textFunctions.map((s) => {
  const offset = `0x${vramToOffset(s.vram).toString(16).toUpperCase()}`;
  const vramHex = `0x${s.vram.toString(16).toUpperCase()}`;
  return `      - [${offset}, asm]       # ${vramHex} ${s.name}`;
});

// Check splat.yaml has the single asm line to replace
const splatContent = readFileSync(SPLAT_PATH, "utf-8");
const asmLinePattern = /^( +- \[0x1A70, asm\].*)$/m;

if (!asmLinePattern.test(splatContent)) {
  console.error(
    "ERROR: Could not find the single asm subsegment line in splat.yaml."
  );
  console.error("Has it already been split, or has the format changed?");
  process.exit(1);
}

const newSplatContent = splatContent.replace(
  asmLinePattern,
  subsegmentLines.join("\n")
);

// Check if symbol_addrs.txt needs to be initialized
const symbolsNeedInit =
  !existsSync(SYMBOLS_PATH) || statSync(SYMBOLS_PATH).size === 0;

const writeMode = process.argv.includes("--write");

if (writeMode) {
  writeFileSync(SPLAT_PATH, newSplatContent);
  console.log(`Wrote ${textFunctions.length} asm subsegments to ${SPLAT_PATH}`);

  if (symbolsNeedInit) {
    const symbolsContent =
      allFunctions.map((f) => `${f.name} = 0x${f.vram.toString(16).toUpperCase()};`).join("\n") +
      "\n";
    writeFileSync(SYMBOLS_PATH, symbolsContent);
    console.log(
      `Initialized ${SYMBOLS_PATH} with ${allFunctions.length} symbols`
    );
  }
} else {
  console.log("\nDry run. Preview of generated subsegments:\n");
  console.log(subsegmentLines.slice(0, 5).join("\n"));
  console.log(`  ... (${subsegmentLines.length - 10} more)`);
  console.log(subsegmentLines.slice(-5).join("\n"));
  if (symbolsNeedInit) {
    console.log(`\nWould also initialize ${SYMBOLS_PATH}`);
  }
  console.log(`\nRun with --write to apply changes`);
}
