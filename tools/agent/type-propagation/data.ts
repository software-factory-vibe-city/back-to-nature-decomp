/** Parsing original assembly/data syntax, never C declarations or layouts. */
import type { Prototype, Witness } from "../calleeTruth.js";

export function selectDataDefinitions(source: string, names: string[]): string[] {
  const lines = source.split("\n"), definitions: string[] = [];
  let section = ".data";
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\.(?:section|data|rodata|rdata)\b/.test(lines[i]!)) section = lines[i]!;
    const label = /^\s*(?:dlabel|glabel)\s+(\w+)/.exec(lines[i]!);
    if (!label || !names.includes(label[1]!)) continue;
    const start = i++;
    while (i < lines.length && !/^\s*(?:enddlabel|dlabel|glabel|nonmatching)\b/.test(lines[i]!)) i++;
    if (/^\s*enddlabel\b/.test(lines[i] ?? "")) i++;
    definitions.push([section, ...lines.slice(start, i)].join("\n") + "\n"); i--;
  }
  return definitions;
}
export interface CallbackTable {
  symbol: string; evidence: string;
  entries: Array<{ offset: number; functionName: string; evidence: string[]; prototype?: Prototype; witness?: Witness }>;
}
export function callbackTablesFromData(source: string, names: string[], origin: string, isFunction: (name: string) => boolean): CallbackTable[] {
  return names.flatMap((symbol) => selectDataDefinitions(source, [symbol]).flatMap((definition) => {
    const words = [...definition.matchAll(/\.word\s+([^\n]+)/g)];
    const entries = words.flatMap((m) => m[1]!.trim().split(/\s*,\s*/));
    if (!entries.length || /\.(?:byte|short|half|float|double|space|ascii)\b/.test(definition) ||
      entries.some((e) => !/^[A-Za-z_]\w*$/.test(e) || !isFunction(e))) return [];
    const line = source.slice(0, source.search(new RegExp(`\\b(?:dlabel|glabel)\\s+${symbol}\\b`))).split("\n").length;
    return [{ symbol, evidence: `${origin}:${line}`, entries: entries.map((functionName, i) => ({ offset: i * 4, functionName, evidence: [`${origin}:${line + i + 1}`] })) }];
  }));
}
