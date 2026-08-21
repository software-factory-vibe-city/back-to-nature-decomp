/**
 * genDisasmSymbols.ts — Generate build/disassembler_symbol_addrs.txt
 *
 * The file spimdisasm reads via --symbol-addrs. Derived from
 * configs/symbol_addrs.txt (hand-maintained + library labels from
 * addLibSymbols.ts) plus __start at the EXE entry point when nothing
 * else covers it.
 *
 * Why rich symbols matter: spimdisasm can only disassemble code it can
 * reach. Library functions invoked indirectly (callbacks, tables) are
 * invisible without symbols — producing uncovered regions and giant
 * phantom "functions" that overrun into data (see
 * notes/clean-room-rebuild-2026-07-25.md). Rich symbols give it entry
 * points, yielding real names and correct function starts.
 *
 * On a cold start (no symbol_addrs.txt yet), this degrades to the old
 * behavior: __start only.
 *
 * Usage:
 *   npx tsx tools/build/genDisasmSymbols.ts           # dry run
 *   npx tsx tools/build/genDisasmSymbols.ts --write   # write the file
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadPsxExeInfo, ROOT, exeSymbolAddrsPath } from "../lib/psxExeInfo.ts";

const SYMBOL_ADDRS = exeSymbolAddrsPath();
const OUT_PATH = join(ROOT, "build", "disassembler_symbol_addrs.txt");

function main() {
  const write = process.argv.includes("--write");
  const info = loadPsxExeInfo();

  const lines: string[] = [];
  if (existsSync(SYMBOL_ADDRS)) {
    const content = readFileSync(SYMBOL_ADDRS, "utf-8");
    for (const line of content.split("\n")) {
      if (line.trim()) lines.push(line);
    }
  }

  /* Ensure a symbol at the entry point */
  const entryHex = `0x${info.entryPoint.toString(16).toUpperCase()}`;
  const hasEntry = lines.some((l) => l.includes(`= ${entryHex};`));
  if (!hasEntry) {
    lines.push(`__start = ${entryHex}; // type:func`);
  }

  const out = lines.join("\n") + "\n";

  if (!write) {
    console.log(`Would write ${lines.length} symbols to ${OUT_PATH}`);
    console.log(lines.slice(0, 5).join("\n"));
    if (lines.length > 5) console.log(`... (${lines.length - 5} more)`);
    console.log("\n(dry run — pass --write to apply)");
    return;
  }

  /* First writer into the build directory on a cold tree — `make split` runs
     before anything has created it, which is the path every autonomous
     workspace takes. */
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, out);
  console.log(`Wrote ${lines.length} symbols to ${OUT_PATH}`);
}

main();
