/**
 * exportEngineSymbols.ts — the PS-X EXE's symbol table, as absolute definitions.
 *
 * Deliverable 8 of plans/overlay-decompilation-enablement.md. When an overlay
 * links, its calls to `0x8001FABC` must resolve, but the EXE is not in that
 * link. Engine symbols enter it as absolute address definitions instead — the
 * same mechanism splat's `undefined_syms_auto.txt` uses — populated from the
 * EXE's own symbol table.
 *
 * Data symbols are not optional. Overlays resolve 251 distinct PS-X EXE
 * `.data`/`.sdata` addresses across 1,725 sites; an export list carrying only
 * functions links cleanly and leaves every global reference wrong.
 *
 * The list is generated, never curated. The measured 246 function entry points
 * and 251 data globals are floors, not ceilings, so the whole symbol table is
 * exported and the build depends on it: rename a function in `src/` and every
 * overlay relinks. The failure mode being designed out is quiet — a stale
 * export produces an overlay that links cleanly and calls the wrong function.
 *
 * Usage:
 *   npx tsx tools/build/exportEngineSymbols.ts --write
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import {
  EXE_CONTAINER_ID,
  containerPath,
  containsVram,
  loadContainers,
  requireContainer,
} from "../lib/container.js";
import { ENGINE_EXPORT_PATH, loadSymbolAddresses } from "../lib/symbolIndex.js";

const NM = "mips-linux-gnu-nm";

const args = process.argv.slice(2);
const write = args.includes("--write");
const check = args.includes("--check");

const exe = requireContainer(EXE_CONTAINER_ID);
const elf = containerPath(exe, "builtElf");

interface ExportedSymbol {
  name: string;
  address: number;
  kind: string;
  source: "elf" | "symbol-table";
}

/**
 * Symbols from the linked ELF — the authoritative post-link answer, because it
 * is what the EXE's own `make check` verified.
 */
function fromElf(): ExportedSymbol[] {
  if (!existsSync(elf)) return [];
  const output = execFileSync(NM, ["--defined-only", elf], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const symbols: ExportedSymbol[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^([0-9a-fA-F]{8})\s+(\S)\s+(\S+)$/);
    if (!match) continue;
    const [, hex, kind, name] = match;
    /* Assembler-local labels, section symbols and splat's variant suffixes are
       not an interface — and a name with a dot in it is not a linker-script
       identifier at all. */
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name!)) continue;
    if (name!.startsWith(".L") || name!.startsWith("_gp_disp")) continue;
    symbols.push({ name: name!, address: Number(`0x${hex}`), kind: kind!, source: "elf" });
  }
  return symbols;
}

/**
 * Fallback for a tree that has not linked yet: the project's own symbol tables.
 *
 * This is strictly weaker — it cannot see a symbol only the link defines — so
 * it is reported as a fallback rather than used silently.
 */
function fromSymbolTables(): ExportedSymbol[] {
  return [...loadSymbolAddresses(exe)].map(([name, address]) => ({
    name,
    address,
    kind: "?",
    source: "symbol-table" as const,
  }));
}

const elfSymbols = fromElf();
const symbols = elfSymbols.length > 0 ? elfSymbols : fromSymbolTables();
const source = elfSymbols.length > 0 ? `${exe.paths.builtElf} (linked)` : "the project symbol tables (no linked ELF yet)";

if (symbols.length === 0) {
  console.error("No engine symbols found. Build the PS-X EXE first: make");
  process.exit(1);
}

/*
 * Only addresses inside PS1 RAM are an interface an overlay can call, and only
 * addresses outside every overlay slot belong in this list: a slot address is
 * defined by whichever overlay is resident, so exporting the EXE's name for it
 * would give an overlay link two definitions of the same address — one of them
 * the wrong one.
 */
const overlays = loadContainers().filter((c) => c.kind === "overlay");

/** splat names an anonymous symbol after its address; a real name outranks that. */
const GENERATED_NAME = /^(?:D|B|func|jtbl|T|_)_?[0-9A-Fa-f]{8}$/;
/** splat's linker script defines section markers; they are geometry, not an interface. */
const SECTION_MARKER = /_(?:RODATA|TEXT|DATA|SDATA|SBSS|BSS)_(?:START|END)$|_VRAM(?:_END)?$|_ROM_(?:START|END)$/;

function betterName(a: string, b: string): string {
  const aGenerated = GENERATED_NAME.test(a);
  const bGenerated = GENERATED_NAME.test(b);
  if (aGenerated !== bGenerated) return aGenerated ? b : a;
  const aMarker = SECTION_MARKER.test(a);
  const bMarker = SECTION_MARKER.test(b);
  if (aMarker !== bMarker) return aMarker ? b : a;
  return a.localeCompare(b) <= 0 ? a : b;
}

/*
 * One name per address.
 *
 * splat refuses a symbol table that gives one address two names, and the
 * overlay assembly it generates is written against whichever name is here — so
 * picking the most informative one is the whole decision. Aliases are dropped
 * rather than renamed.
 */
const byAddress = new Map<number, ExportedSymbol>();
for (const symbol of symbols) {
  if (symbol.address < 0x80000000 || symbol.address >= 0x80200000) continue;
  if (overlays.some((container) => containsVram(container, symbol.address))) continue;
  const existing = byAddress.get(symbol.address);
  if (!existing) {
    byAddress.set(symbol.address, symbol);
    continue;
  }
  const winner = betterName(existing.name, symbol.name);
  if (winner !== existing.name) byAddress.set(symbol.address, symbol);
}

/*
 * A name defined at more than one address is not an interface.
 *
 * `__gnu_compiled_c` and friends are per-translation-unit assembler markers
 * that recur at every object's first symbol. Exporting one would define a name
 * that means nothing and hide whichever address happened to win.
 */
const nameCounts = new Map<string, number>();
for (const symbol of byAddress.values()) {
  nameCounts.set(symbol.name, (nameCounts.get(symbol.name) ?? 0) + 1);
}
const ambiguousNames = [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);

const exported = [...byAddress.values()]
  .filter((symbol) => (nameCounts.get(symbol.name) ?? 0) === 1)
  .sort((a, b) => a.address - b.address);
const aliasesDropped = symbols.length - exported.length;

/*
 * Bare assignments, no comment header. This one file is read by two parsers
 * with incompatible comment syntax — splat's symbol_addrs reader (`//`) and
 * GNU ld's linker script reader (`/* *' + '/`) — so it carries no comment at all,
 * and its provenance is written beside it.
 */
const lines =
  exported.map((s) => `${s.name} = 0x${s.address.toString(16).toUpperCase().padStart(8, "0")};`).join("\n") + "\n";

const provenance = [
  "Generated by tools/build/exportEngineSymbols.ts — do not edit engine_syms.txt by hand.",
  `Source: ${source}`,
  `Symbols: ${exported.length}`,
  "",
].join("\n");

const outPath = join(ROOT, ENGINE_EXPORT_PATH);

if (check) {
  /* A stale export links cleanly and calls the wrong function, so staleness has
     to fail the build rather than be reported. */
  const current = existsSync(outPath) ? readFileSync(outPath, "utf-8") : null;
  if (current === lines) {
    console.log(`${ENGINE_EXPORT_PATH} is current (${exported.length} symbols)`);
    process.exit(0);
  }
  console.error(
    current === null
      ? `${ENGINE_EXPORT_PATH} does not exist; every overlay link would resolve engine calls to nothing.`
      : `${ENGINE_EXPORT_PATH} is stale against ${source}. An overlay linked against it would call the wrong function.`
  );
  console.error("  Regenerate: npx tsx tools/build/exportEngineSymbols.ts --write");
  process.exit(1);
}

if (write) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines);
  writeFileSync(`${outPath.replace(/\.txt$/, "")}.provenance.txt`, provenance);
  console.log(
    `Wrote ${ENGINE_EXPORT_PATH}: ${exported.length} engine symbols from ${source} ` +
      `(${aliasesDropped} alias or out-of-scope symbol(s) dropped)`
  );
  if (ambiguousNames.length > 0) {
    console.log(
      `  ${ambiguousNames.length} name(s) defined at more than one address are not exported: ` +
        `${ambiguousNames.slice(0, 5).join(", ")}${ambiguousNames.length > 5 ? ", …" : ""}`
    );
  }
} else {
  console.log(`Would write ${exported.length} engine symbols from ${source}`);
}
