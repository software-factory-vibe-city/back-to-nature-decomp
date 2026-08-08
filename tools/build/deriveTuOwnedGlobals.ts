/**
 * Derive per-TU global ownership from the original bytes.
 *
 * ASPSX addresses a global GP-relatively only when the translation unit
 * declares it, and absolutely otherwise. maspsx implements the same rule:
 * `.comm`/`.lcomm`/`.sdata` contents populate its small-data tables, `.extern`
 * does not. So a file whose target code reaches a symbol through `$gp` must
 * carry a tentative definition of that symbol, and a file that does not reach
 * it that way must not.
 *
 * That fact is readable from the shipped binary: every `$gp`-based load, store
 * or address computation in a function's original bytes names a symbol its
 * translation unit owns. This tool reads it rather than asking anyone to
 * maintain a table.
 *
 * Two witnesses are reported. The primary one is the original bytes, which
 * works for functions that are still assembly. The second is the
 * `R_MIPS_GPREL16` relocations of an already-compiled object, which names
 * symbols exactly instead of inferring them from an address, and therefore
 * resolves the one thing the byte scan cannot: whether `$gp + disp` is
 * `SYM` or `OTHER + n`. Where both exist they must agree.
 *
 * Usage:
 *   npx tsx tools/build/deriveTuOwnedGlobals.ts                 # report
 *   npx tsx tools/build/deriveTuOwnedGlobals.ts --json          # machine-readable
 *   npx tsx tools/build/deriveTuOwnedGlobals.ts func_80011370   # one function
 *   npx tsx tools/build/deriveTuOwnedGlobals.ts --check         # validate witnesses
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { loadPsxExeInfo, vramToRom } from "../lib/psxExeInfo.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** $gp is register 28 in the o32 ABI, and is never a scratch register. */
const GP_REGISTER = 28;

/**
 * I-type opcodes whose `rs` field is a base address or address source.
 * Loads and stores reach a global directly; `addi`/`addiu`/`ori` materialise
 * its address (what the assembler's `la` macro expands to under small data).
 */
const GP_BASE_OPCODES = new Set([
  0x08, /* addi  */ 0x09, /* addiu */ 0x0d, /* ori   */
  0x20, /* lb    */ 0x21, /* lh    */ 0x22, /* lwl   */ 0x23, /* lw    */
  0x24, /* lbu   */ 0x25, /* lhu   */ 0x26, /* lwr   */
  0x28, /* sb    */ 0x29, /* sh    */ 0x2a, /* swl   */ 0x2b, /* sw    */
  0x2e, /* swr   */
  0x31, /* lwc1  */ 0x32, /* lwc2  */ 0x39, /* swc1  */ 0x3a, /* swc2  */
]);

export interface FunctionSpan {
  name: string;
  vram: number;
  rom: number;
  size: number;
  /** `c` once splat expects a C implementation, `asm` while it does not. */
  kind: "c" | "asm";
}

/**
 * Function extents from configs/splat.yaml.
 *
 * A subsegment's size is the distance to the next subsegment of any kind, so
 * the offsets of every subsegment are collected, not only the function ones.
 */
export function loadFunctionSpans(): FunctionSpan[] {
  const yaml = readFileSync(join(ROOT, "configs/splat.yaml"), "utf-8");
  const offsets: number[] = [];
  const partial: Array<{ name: string; rom: number; vram: number; kind: "c" | "asm" }> = [];

  for (const line of yaml.split("\n")) {
    const any = line.match(/^\s*-\s*\[(0x[0-9A-Fa-f]+)/);
    if (any) offsets.push(Number(any[1]));

    const fn = line.match(
      /^\s*-\s*\[(0x[0-9A-Fa-f]+),\s*(asm|c)(?:,\s*([A-Za-z_][A-Za-z0-9_]*))?\]\s*#\s*(0x[0-9A-Fa-f]+)\s+(\S+)/,
    );
    if (fn) {
      partial.push({ name: fn[3] ?? fn[5], rom: Number(fn[1]), vram: Number(fn[4]), kind: fn[2] as "c" | "asm" });
    }
  }

  const sorted = [...new Set(offsets)].sort((a, b) => a - b);
  return partial.map((entry) => {
    const index = sorted.indexOf(entry.rom);
    const next = (index >= 0 ? sorted[index + 1] : undefined) ?? entry.rom;
    return { ...entry, size: next - entry.rom };
  });
}

/** Every `.s` file splat generates, so data labels can be indexed by address. */
function collectAsmFiles(directory: string, accumulator: string[] = []): string[] {
  if (!existsSync(directory)) return accumulator;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) collectAsmFiles(path, accumulator);
    else if (entry.endsWith(".s")) accumulator.push(path);
  }
  return accumulator;
}

export interface SymbolIndex {
  /** Exact address -> symbol name. */
  byAddress: Map<number, string>;
  /** Ascending addresses, for resolving an interior reference to its base. */
  addresses: number[];
}

/**
 * Address -> symbol, from the generated artifacts that already carry it.
 *
 * `dlabel`/`glabel`/`jlabel` in splat's assembly are authoritative for
 * extracted data; the `NAME = 0xADDR;` tables cover symbols that have no
 * extracted bytes. Nothing here is specific to one game.
 */
export function loadSymbolIndex(): SymbolIndex {
  const byAddress = new Map<number, string>();

  const assignmentFiles = [
    join(ROOT, "configs/symbol_addrs.txt"),
    join(ROOT, "build/undefined_syms_auto.txt"),
    join(ROOT, "build/undefined_funcs_auto.txt"),
    join(ROOT, "build/dep_syms.txt"),
    join(ROOT, "build/lib_bss_syms.txt"),
  ];
  for (const file of assignmentFiles) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf-8").split("\n")) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0x[0-9A-Fa-f]+)/);
      if (match) byAddress.set(Number(match[2]), match[1]);
    }
  }

  /* Data labels win over the assignment tables: they are the extracted
   * definition, and splat regenerates them from the binary every split. */
  for (const file of collectAsmFiles(join(ROOT, "build/asm"))) {
    let pending: string | null = null;
    for (const line of readFileSync(file, "utf-8").split("\n")) {
      const label = line.match(/^\s*(?:dlabel|glabel|jlabel)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (label) {
        pending = label[1];
        continue;
      }
      if (!pending) continue;
      const located = line.match(/\/\*\s*[0-9A-Fa-f]+\s+([0-9A-Fa-f]{8})\s/);
      if (located) {
        byAddress.set(Number(`0x${located[1]}`), pending);
        pending = null;
      }
    }
  }

  return { byAddress, addresses: [...byAddress.keys()].sort((a, b) => a - b) };
}

/** The symbol an address falls in: exact name, or base symbol plus offset. */
export function resolveAddress(index: SymbolIndex, address: number): { symbol: string; offset: number } | null {
  const exact = index.byAddress.get(address);
  if (exact) return { symbol: exact, offset: 0 };

  let low = 0;
  let high = index.addresses.length - 1;
  let base: number | undefined;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = index.addresses[mid];
    if (candidate === undefined) break;
    if (candidate <= address) {
      base = candidate;
      low = mid + 1;
    } else high = mid - 1;
  }
  if (base === undefined) return null;
  const symbol = index.byAddress.get(base);
  return symbol === undefined ? null : { symbol, offset: address - base };
}

export interface GpAccess {
  /** Address of the instruction that made the access. */
  vram: number;
  /** Address it reached: `$gp` plus the sign-extended displacement. */
  target: number;
  symbol: string | null;
  offset: number;
}

/**
 * Every `$gp`-based reference in a function's original bytes.
 *
 * The displacement is a signed 16-bit field, so the reachable set is exactly
 * the `$gp` window — which is why an out-of-window symbol can never be a
 * GP-relative access and needs no ownership decision.
 */
export function scanGpAccesses(
  bytes: Buffer,
  vram: number,
  gpValue: number,
  index: SymbolIndex,
): GpAccess[] {
  const accesses: GpAccess[] = [];
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    const word = bytes.readUInt32LE(offset);
    const opcode = word >>> 26;
    if (!GP_BASE_OPCODES.has(opcode)) continue;
    if (((word >>> 21) & 0x1f) !== GP_REGISTER) continue;
    const raw = word & 0xffff;
    const displacement = raw >= 0x8000 ? raw - 0x10000 : raw;
    const target = (gpValue + displacement) >>> 0;
    const resolved = resolveAddress(index, target);
    accesses.push({
      vram: vram + offset,
      target,
      symbol: resolved?.symbol ?? null,
      offset: resolved?.offset ?? 0,
    });
  }
  return accesses;
}

/** `R_MIPS_GPREL16` symbols of a compiled object — exact, but build-dependent. */
export function objectGprelSymbols(objectPath: string): Set<string> | null {
  if (!existsSync(objectPath)) return null;
  const dump = execFileSync("mips-linux-gnu-objdump", ["-r", objectPath], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const symbols = new Set<string>();
  for (const line of dump.split("\n")) {
    const match = line.match(/^[0-9a-f]+\s+R_MIPS_GPREL16\s+(\S+)/);
    if (match) symbols.add(match[1].replace(/[-+]0x[0-9a-f]+$/, ""));
  }
  return symbols;
}

export type SourceKind = "c" | "include-asm" | "absent";

/**
 * How a function reaches the build.
 *
 * An `INCLUDE_ASM` stub needs no tentative definition: its `.s` carries
 * explicit `%gp_rel` relocations, which GNU `as` honours whatever the
 * small-data threshold is. Only compiled C depends on the declaration.
 */
export function classifySource(name: string): { kind: SourceKind; path: string | null } {
  const path = join(ROOT, "src", `${name}.c`);
  if (!existsSync(path)) return { kind: "absent", path: null };
  const text = readFileSync(path, "utf-8");
  const stub = new RegExp(`INCLUDE_ASM\\([^)]*\\b${name}\\b`).test(text);
  return { kind: stub ? "include-asm" : "c", path };
}

export interface OwnershipRecord {
  name: string;
  source: SourceKind;
  /** Symbols the original bytes reach through `$gp`. */
  fromBytes: string[];
  /** Interior references (`SYM+n`) — the byte scan cannot name their base. */
  interior: string[];
  /** Addresses no symbol table covers. */
  unresolved: number[];
  /** Symbols the compiled object relocates GP-relative, when one exists. */
  fromObject: string[] | null;
}

export function deriveOwnership(filter?: string): OwnershipRecord[] {
  const info = loadPsxExeInfo();
  const index = loadSymbolIndex();
  const binary = readFileSync(info.binaryPath);
  const records: OwnershipRecord[] = [];

  for (const span of loadFunctionSpans()) {
    if (filter && span.name !== filter) continue;
    const rom = vramToRom(span.vram, info);
    const bytes = binary.subarray(rom, rom + span.size);
    const accesses = scanGpAccesses(bytes, span.vram, info.gpValue, index);
    if (accesses.length === 0) continue;

    const exact = new Set<string>();
    const interior = new Set<string>();
    const unresolved: number[] = [];
    for (const access of accesses) {
      if (access.symbol === null) unresolved.push(access.target);
      else if (access.offset === 0) exact.add(access.symbol);
      else interior.add(`${access.symbol}+${access.offset}`);
    }

    const source = classifySource(span.name);
    records.push({
      name: span.name,
      source: source.kind,
      fromBytes: [...exact].sort(),
      interior: [...interior].sort(),
      unresolved,
      fromObject: source.kind === "absent"
        ? null
        : [...(objectGprelSymbols(join(ROOT, "build/src", `${span.name}.c.o`)) ?? [])].sort(),
    });
  }
  return records;
}

/**
 * Symbols a compiled C file must define tentatively.
 *
 * Where the object exists its relocations are used, because they name the
 * symbol rather than inferring it from an address. Otherwise the byte scan
 * stands on its own, which is the case that matters for a function that has
 * not been decompiled yet.
 */
export function requiredDefinitions(record: OwnershipRecord): string[] {
  if (record.source !== "c") return [];
  if (record.fromObject && record.fromObject.length > 0) return record.fromObject;
  return record.fromBytes;
}

function reportText(records: OwnershipRecord[]): string {
  const lines: string[] = [];
  const counts = { c: 0, "include-asm": 0, absent: 0 } as Record<SourceKind, number>;
  for (const record of records) counts[record.source]++;

  lines.push("TU-owned globals, derived from $gp references in the original bytes.");
  lines.push("");
  lines.push(`functions with $gp references : ${records.length}`);
  lines.push(`  compiled from C             : ${counts.c}  (need tentative definitions)`);
  lines.push(`  INCLUDE_ASM stubs           : ${counts["include-asm"]}  (the .s carries %gp_rel already)`);
  lines.push(`  no source file yet          : ${counts.absent}`);
  const distinct = new Set<string>();
  for (const record of records) {
    if (record.source === "c") for (const symbol of requiredDefinitions(record)) distinct.add(symbol);
  }
  lines.push(`distinct symbols owned by compiled C : ${distinct.size}`);
  lines.push("");

  for (const record of records) {
    if (record.source !== "c") continue;
    const required = requiredDefinitions(record);
    lines.push(`${record.name}  [${required.length}]`);
    lines.push(`  ${required.join(" ")}`);
    if (record.interior.length > 0) lines.push(`  interior: ${record.interior.join(" ")}`);
    if (record.unresolved.length > 0) {
      lines.push(`  unresolved: ${record.unresolved.map((a) => `0x${a.toString(16)}`).join(" ")}`);
    }
  }
  return lines.join("\n");
}

/**
 * Cross-check the two witnesses in both directions.
 *
 * A relocation the byte scan cannot account for means one of the inputs is
 * stale. The reverse — a symbol the original reaches through `$gp` that the
 * object does not relocate GP-relative — means the file is missing its
 * tentative definition and is addressing that global absolutely. That is the
 * failure the interim `.extern`-widening bridge used to mask, so it is worth a
 * standing check rather than a one-off migration test.
 *
 * A disagreement is reported, never silently reconciled.
 */
function checkText(records: OwnershipRecord[]): { text: string; failures: number } {
  const lines: string[] = [];
  let failures = 0;

  /* `SYM+n` is a reference into a neighbouring label's object, so the two
   * witnesses naming different symbols there is agreement, not a difference. */
  const interiorBases = (record: OwnershipRecord) =>
    new Set(record.interior.map((entry) => entry.split("+")[0]));

  lines.push("Witness agreement (compiled C files only)");
  let unaccounted = 0;
  let undefined_ = 0;
  for (const record of records) {
    if (record.source !== "c" || record.fromObject === null) continue;
    const bytes = new Set(record.fromBytes);
    const relocated = new Set(record.fromObject);
    const bases = interiorBases(record);

    for (const symbol of record.fromObject) {
      if (bytes.has(symbol) || bases.has(symbol)) continue;
      failures++;
      unaccounted++;
      lines.push(`  MISMATCH ${record.name}: object relocates ${symbol}, the original bytes do not reach it`);
    }
    for (const symbol of record.fromBytes) {
      if (relocated.has(symbol) || bases.has(symbol)) continue;
      failures++;
      undefined_++;
      lines.push(`  MISSING  ${record.name}: reaches ${symbol} through $gp but the object addresses it absolutely`);
    }
  }
  if (unaccounted === 0) lines.push("  OK: every object relocation is accounted for by the byte scan");
  if (undefined_ === 0) lines.push("  OK: every symbol the original reaches through $gp is defined by its file");

  const owners = new Map<string, string[]>();
  for (const record of records) {
    for (const symbol of record.fromBytes) {
      owners.set(symbol, [...(owners.get(symbol) ?? []), record.name]);
    }
  }

  /* Symbols reached both ways across the program are the ones that make
   * ownership observable at all; listing them keeps the evidence reproducible. */
  lines.push("");
  lines.push("Symbols owned by more than one function group");
  const shared = [...owners.entries()].filter(([, names]) => names.length > 1);
  lines.push(`  ${shared.length} of ${owners.size} owned symbols have several owning functions`);

  return { text: lines.join("\n"), failures };
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const check = args.includes("--check");
  const filter = args.find((arg) => !arg.startsWith("--"));
  const records = deriveOwnership(filter);

  if (json) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }
  console.log(reportText(records));
  if (check) {
    const result = checkText(records);
    console.log("");
    console.log(result.text);
    if (result.failures > 0) process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
