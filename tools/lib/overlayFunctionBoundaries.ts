/**
 * Overlay function-info rows are fragments, not necessarily functions. When
 * .rodata is analysed alongside .text, spimdisasm identifies switch arms as
 * @jumptablelabel and records their parentFunction. Collapse only those proven
 * local fragments; never infer membership from a name, a return or adjacency.
 */

import type { CsvEntry } from "../build/analyzeLayout.js";
import type { OverlayLayout } from "./overlayLayout.js";
import { jalTarget } from "./mips.js";

export interface OverlayFunction {
  address: number;
  name: string;
  /** Explicit extent only when local fragments were absorbed. */
  size?: number;
}

interface ContextSymbol {
  address: number;
  name: string;
  type: string;
  parent: string;
}

/** spimdisasm's section-split CSV. Data is never disassembled as instructions. */
export function overlaySectionSplits(base: number, layout: OverlayLayout): string {
  const rows: string[] = [];
  const section = (kind: string, start: number) => {
    rows.push(`offset,vram,${kind}`, `${start.toString(16)},${(base + start).toString(16)},overlay`);
  };
  if (layout.rodataStart < layout.textStart) section(".rodata", layout.rodataStart);
  section(".text", layout.textStart);
  rows.push(`${layout.dataStart.toString(16)},${(base + layout.dataStart).toString(16)},.end`);
  return rows.join("\n") + "\n";
}

function contextSymbols(csv: string): ContextSymbol[] {
  const lines = csv.trim().split(/\r?\n/);
  const columns = lines[0]!.split(",");
  const required = ["category", "address", "getName", "getType", "parentFunction"];
  for (const column of required) {
    if (!columns.includes(column)) throw new Error(`spimdisasm context is missing ${column}`);
  }
  const field = (row: string[], column: string): string => {
    const value = row[columns.indexOf(column)];
    if (value === undefined) throw new Error(`spimdisasm context row is missing ${column}`);
    return value;
  };
  return lines.slice(1).filter(Boolean).flatMap((line) => {
    const row = line.split(",");
    if (field(row, "category") !== "symbol") return [];
    const address = Number(field(row, "address"));
    if (!Number.isSafeInteger(address)) throw new Error(`invalid spimdisasm symbol address: ${line}`);
    return [{ address, name: field(row, "getName"), type: field(row, "getType"), parent: field(row, "parentFunction") }];
  });
}

/** Direct calls contradict a local-label classification; ignore call-shaped data. */
export function overlayDirectCalls(bytes: Buffer, base: number, layout: OverlayLayout): Set<number> {
  const calls = new Set<number>();
  for (let offset = layout.textStart; offset + 4 <= layout.dataStart; offset += 4) {
    const target = jalTarget(bytes.readUInt32LE(offset), base + offset);
    if (target !== null) calls.add(target);
  }
  return calls;
}

/** Recover function extents from independently analysed text/rodata metadata. */
export function overlayFunctionsFromContext(
  entries: readonly CsvEntry[], context: string, prefix: string, textStart: number, textEnd: number,
  independentEntries: ReadonlySet<number> = new Set(),
): OverlayFunction[] {
  const symbols = contextSymbols(context);
  const byAddress = new Map(symbols.map((s) => [s.address, s]));
  const byName = new Map(symbols.map((s) => [s.name, s]));
  const fragments = entries.filter((e) => e.address >= textStart && e.address < textEnd)
    .sort((a, b) => a.address - b.address);
  const functions: OverlayFunction[] = [];
  let previousEnd = textStart;
  for (const entry of fragments) {
    const end = entry.address + entry.length;
    if (!Number.isSafeInteger(entry.address) || !Number.isSafeInteger(entry.length) ||
        entry.length <= 0 || entry.address % 4 !== 0 || entry.length % 4 !== 0 || entry.address < previousEnd || end > textEnd) {
      throw new Error(`invalid or overlapping overlay fragment at 0x${entry.address.toString(16)}`);
    }
    const symbol = byAddress.get(entry.address);
    if (!symbol) throw new Error(`no symbol type for overlay fragment at 0x${entry.address.toString(16)}`);
    if (symbol.type === "@function") {
      functions.push({ address: entry.address, name: `${prefix}func_${entry.address.toString(16).toUpperCase()}` });
    } else if (symbol.type === "@jumptablelabel" || symbol.type === "@branchlabel") {
      if (independentEntries.has(entry.address)) {
        throw new Error(`local overlay fragment ${symbol.name} is also an independent call target — boundary evidence conflicts`);
      }
      let parent = byName.get(symbol.parent);
      const seen = new Set([symbol.name]);
      while (parent && parent.type !== "@function" && !seen.has(parent.name)) {
        seen.add(parent.name);
        parent = byName.get(parent.parent);
      }
      const head = functions.at(-1);
      if (!head || !parent || parent.type !== "@function" || parent.address !== head.address || entry.address !== previousEnd) {
        throw new Error(`local overlay fragment ${symbol.name} has no contiguous owning function — refusing to promote or discard it`);
      }
      head.size = end - head.address;
    } else {
      throw new Error(`unsupported overlay fragment type ${symbol.type} at 0x${entry.address.toString(16)}`);
    }
    previousEnd = end;
  }
  return functions;
}

/** The same explicit extent must reach both spimdisasm and splat. */
export function overlayFunctionSymbols(functions: readonly OverlayFunction[]): string {
  return functions.map((fn) => `${fn.name} = 0x${fn.address.toString(16).toUpperCase()}; // ` +
    (fn.size === undefined ? "" : `size:0x${fn.size.toString(16)} `) + "type:func").join("\n") + "\n";
}
