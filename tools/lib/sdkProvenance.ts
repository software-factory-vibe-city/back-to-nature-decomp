/** Evidence-backed retirement of SDK labels and boundary-premise checking. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { conventionalOPath, isReturnPadding, readTextObject, type SigEntry, type TextObject } from "./psyqMembers.js";

export function staleSdkSymbols(content: string, matches: { vramStart: number; vramEnd: number; oPath: string }[], root: string, version: string, retiredObjectPaths: Set<string>): string[] {
  const sdkNames = new Set<string>();
  const dir = join(root, "tools/vendor/psx_psyq_signatures", version);
  for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const entries: SigEntry[] = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const entry of entries) {
      if (!retiredObjectPaths.has(conventionalOPath(file, entry.name)?.oPath ?? "")) continue;
      for (const label of entry.labels ?? []) {
        if (!/^(loc_|text_)/.test(label.name)) sdkNames.add(label.name);
      }
    }
  }
  const stale: string[] = [];
  const symbols = new Map<string, TextObject["symbols"]>();
  for (const line of content.split("\n")) {
    const parsed = line.match(/^(\S+)\s*=\s*(0x[\da-f]+)\s*;/i);
    if (!parsed) continue;
    const name = parsed[1]!, vram = Number(parsed[2]);
    // At the start, preserve deliberate user renames. Interior SDK labels can
    // only belong to the verified member if that member actually exports them.
    const owner = matches.find(m => vram > m.vramStart && vram < m.vramEnd);
    if (!owner) continue;
    const manufacturedGeneric = /^func_[\da-f]{8}$/i.test(name) && owner.oPath.startsWith("build/sdk/lib/") && owner.oPath.includes("__");
    if (!sdkNames.has(name) && !manufacturedGeneric) continue;
    if (!symbols.has(owner.oPath)) symbols.set(owner.oPath, readTextObject(readFileSync(join(root, owner.oPath))).symbols);
    if (!symbols.get(owner.oPath)!.some(s => s.name === name && owner.vramStart + s.offset === vram)) stale.push(name);
  }
  return stale;
}

export interface BoundaryPremise {
  missingTerminal: boolean;
  adjacentReturnPadding: boolean;
  evidence: string[];
}
/** Tail calls are legitimate terminals, unlike a missing epilogue. A missing
 * return alone is a signal (noreturn C exists), not proof of a bad boundary. */
export function boundaryPremise(bytes: Buffer, vram: number, next?: TextObject): BoundaryPremise {
  let terminal = false;
  for (let i = 0; i + 4 <= bytes.length; i += 4) {
    const word = bytes.readUInt32LE(i);
    if ((word & 0xfc00003f) === 8 && (word & 0x001fffc0) === 0) terminal = true; /* jr, including indirect tail calls */
    if (word >>> 26 === 2) {
      const target = (((vram + i + 4) & 0xf0000000) | ((word & 0x03ffffff) << 2)) >>> 0;
      if (target < vram || target >= vram + bytes.length) terminal = true;
    }
  }
  const adjacentReturnPadding = next !== undefined && isReturnPadding(next);
  const missingTerminal = !terminal;
  const evidence: string[] = [];
  if (missingTerminal) evidence.push(`Region [0x${vram.toString(16)}, 0x${(vram + bytes.length).toString(16)}) contains neither its own return nor an external tail transfer.`);
  if (adjacentReturnPadding) evidence.push(`The immediately following SDK object is only jr $ra plus padding with zero relocations; it may be this region's missing epilogue. A generated symbol name cannot establish that placement.`);
  return { missingTerminal, adjacentReturnPadding, evidence };
}

export function followingTextObject(root: string, segmentName: string | null): TextObject | undefined {
  if (!segmentName || !/^\.\.\/(?:lib|build\/sdk\/lib)\//.test(segmentName)) return undefined;
  const file = join(root, segmentName.slice(3) + ".o");
  if (!existsSync(file)) return undefined;
  return readTextObject(readFileSync(file));
}
