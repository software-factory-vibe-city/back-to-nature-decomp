/**
 * Small-data `.extern` correction: keep GNU as from GP-relativising symbols
 * that cannot be reached from $gp.
 *
 * cc1 decides whether to split a symbolic address from the declared size
 * alone. A declaration at or below the -G threshold sets SYMBOL_REF_FLAG, so
 * mips_check_split() leaves the address unsplit and cc1 emits the assembler
 * macro (`lw $6,SYM`) together with `.extern SYM, <size>`. Anything larger is
 * split into an explicit `lui`/`%lo` pair using two registers.
 *
 * GNU as then expands that macro GP-relatively whenever the `.extern` size is
 * within its own -G threshold -- for *any* symbol, including ones this TU does
 * not define and which the linker will place far outside the +/-32KB $gp
 * window. ASPSX does not do this: it only uses GP-relative addressing for
 * in-file declarations, and expands the macro absolutely otherwise, producing
 * the single-register self-clobber pair (`lui $6,%hi(SYM)` /
 * `lw $6,%lo(SYM)($6)`) that the original binaries are full of.
 *
 * The consequence is not merely a mismatch. A small `.extern` for an
 * out-of-range symbol makes the link fail outright:
 *
 *     relocation truncated to fit: R_MIPS_GPREL16 against `D_80010098'
 *
 * so the only way to build was to over-declare such globals as arrays, which
 * clears SYMBOL_REF_FLAG and forces the two-register split form that the
 * target does not use.
 *
 * This pass restores the assembler's side of the contract without touching
 * cc1's: for each `.extern SYM, <size>` whose size is small enough to trigger
 * GNU as's small-data path but whose *address* lies outside the $gp window, it
 * widens the recorded size past the threshold. cc1 has already made its
 * decision by then, so the macro form -- and its self-clobber expansion --
 * survives, while genuinely GP-addressable symbols are left untouched and keep
 * their `%gp_rel` accesses.
 *
 * Addresses come from configs/symbol_addrs.txt; generated `D_xxxxxxxx` and
 * `jtbl_xxxxxxxx` names encode the address and are used as a fallback. A
 * symbol whose address cannot be established is left alone.
 */

import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The MIPS GP window is a signed 16-bit displacement from $gp. */
const GP_WINDOW = 0x8000;

/** $gp is project configuration; splat holds the authoritative value. */
export function configuredGpValue(): number {
  const splat = readFileSync(join(ROOT, "configs/splat.yaml"), "utf-8");
  const value = splat.match(/^\s*gp_value:\s*(0x[0-9A-Fa-f]+|\d+)/m)?.[1];
  if (!value) throw new Error("configs/splat.yaml does not define gp_value; cannot resolve the GP window.");
  return Number(value);
}

/** The assembler's small-data threshold, read from the Makefile's ASFLAGS. */
export function configuredGThreshold(): number {
  const makefile = readFileSync(join(ROOT, "Makefile"), "utf-8");
  const line = makefile.match(/^ASFLAGS\s*:?=\s*(.*)$/m)?.[1];
  if (line === undefined) throw new Error("Makefile does not define ASFLAGS; cannot resolve the -G threshold.");
  const g = line.match(/-G(\d+)/)?.[1];
  return g === undefined ? 8 : Number(g);
}

export function loadSymbolAddresses(): Map<string, number> {
  const addresses = new Map<string, number>();
  let text: string;
  try {
    text = readFileSync(join(ROOT, "configs/symbol_addrs.txt"), "utf-8");
  } catch {
    return addresses;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(0x[0-9A-Fa-f]+)/);
    if (match) addresses.set(match[1], Number(match[2]));
  }
  return addresses;
}

/** Generated names carry their address; used only when the table has no entry. */
function addressFromName(symbol: string): number | undefined {
  const match = symbol.match(/^(?:D_|jtbl_)([0-9A-Fa-f]{8})$/);
  return match ? Number(`0x${match[1]}`) : undefined;
}

/**
 * Per-TU disowned symbols.
 *
 * Being inside the $gp window is necessary for GP-relative addressing but not
 * sufficient: ASPSX only uses it for symbols the translation unit declares
 * itself, and addresses everything else absolutely. A symbol can therefore be
 * GP-relative in the TU that owns it and absolute in every other TU -- the
 * original binary does exactly that for the 0x8005E3A4..0x8005E3C0 cluster.
 *
 * Our headers give every file the same view, so ownership cannot be expressed
 * in C. This file records it instead: each entry names a source stem and the
 * in-window symbols that stem does *not* own, which are then addressed
 * absolutely. Symbols outside the window need no entry -- they are handled by
 * the address test.
 */
export function loadDisownedSymbols(): Map<string, Set<string>> {
  const overrides = new Map<string, Set<string>>();
  let text: string;
  try {
    text = readFileSync(join(ROOT, "configs/tu_externs.txt"), "utf-8");
  } catch {
    return overrides;
  }
  for (const line of text.split("\n")) {
    const stripped = line.replace(/#.*$/, "").trim();
    if (!stripped) continue;
    const match = stripped.match(/^(\S+)\s*=\s*(.*)$/);
    if (!match) continue;
    const symbols = match[2].split(/[\s,]+/).filter(Boolean);
    if (symbols.length > 0) overrides.set(match[1], new Set(symbols));
  }
  return overrides;
}

export interface ExternRewrite {
  symbol: string;
  address: number;
  declaredSize: number;
}

export function rewriteSmallDataExterns(
  assembly: string,
  options: {
    gpValue?: number;
    threshold?: number;
    addresses?: Map<string, number>;
    disowned?: Set<string>;
  } = {},
): { assembly: string; rewrites: ExternRewrite[] } {
  const gp = options.gpValue ?? configuredGpValue();
  const threshold = options.threshold ?? configuredGThreshold();
  const addresses = options.addresses ?? loadSymbolAddresses();
  const disowned = options.disowned ?? new Set<string>();
  const low = gp - GP_WINDOW;
  const high = gp + GP_WINDOW;
  const rewrites: ExternRewrite[] = [];

  const patched = assembly.replace(
    /^(\s*\.extern\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*,\s*)(\d+)/gm,
    (whole, head: string, symbol: string, sep: string, sizeText: string) => {
      const declaredSize = Number(sizeText);
      if (declaredSize > threshold) return whole;
      if (!disowned.has(symbol)) {
        const address = addresses.get(symbol) ?? addressFromName(symbol);
        /* Unknown address: prove nothing, change nothing. */
        if (address === undefined) return whole;
        if (address >= low && address < high) return whole;
        rewrites.push({ symbol, address, declaredSize });
        return `${head}${symbol}${sep}${threshold + 1}`;
      }
      rewrites.push({ symbol, address: addresses.get(symbol) ?? addressFromName(symbol) ?? 0, declaredSize });
      return `${head}${symbol}${sep}${threshold + 1}`;
    },
  );

  return { assembly: patched, rewrites };
}

/** Rewrite a cc1 assembly file in place. Returns what was changed. */
export function fixSmallDataExternsInFile(path: string): ExternRewrite[] {
  const original = readFileSync(path, "utf-8");
  const stem = basename(path).replace(/\.s$/, "");
  const { assembly, rewrites } = rewriteSmallDataExterns(original, {
    disowned: loadDisownedSymbols().get(stem),
  });
  if (rewrites.length > 0) writeFileSync(path, assembly);
  return rewrites;
}

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const files = args.filter((arg) => !arg.startsWith("--"));
  if (files.length === 0) {
    console.error("usage: fixSmallDataExterns.ts <assembly.s> [...] [--verbose]");
    process.exit(2);
  }
  for (const file of files) {
    const rewrites = fixSmallDataExternsInFile(file);
    if (verbose && rewrites.length > 0) {
      for (const r of rewrites) {
        console.error(
          `${file}: ${r.symbol} @ 0x${r.address.toString(16)} is outside the $gp window; ` +
            `.extern size ${r.declaredSize} -> ${configuredGThreshold() + 1}`,
        );
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
