/** Collision-safe SDK object identities. The stored member name is NOT an ID. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { elf32Sections } from "./elfSections.js";

export interface SigEntry {
  name: string;
  sig: string;
  labels: { name: string; offset: number }[];
}
export interface SdkMember {
  name: string;
  ordinal: number;
  offset: number;
  bytes: Buffer;
}
export interface MemberRecord {
  source: string;
  member: string;
  ordinal: number;
  sourceOffset: number;
  sourceHash: string;
  symbols: { name: string; offset: number }[];
  oPath: string;
  collision: boolean;
}
export interface MemberMap {
  schemaVersion: 1;
  version: string;
  members: MemberRecord[];
  signatures: { sigFile: string; identity: string; oPath: string }[];
}
export const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
export const signatureId = (entry: SigEntry): string => hash(JSON.stringify(entry));
export const memberKey = (name: string): string => name.replace(/\.(obj|o)$/i, "").toLowerCase();
/** Original and regenerated SDK inputs share the existing patched-object tree. */
export const patchedSdkObjectPath = (oPath: string): string => `build/${oPath.replace(/^build\/sdk\//, "")}`;

/** Original LIB v1/v2 layouts, witnessed by the vendored MipsDis parser. Fail
 * closed on truncation; never scan for LNK magic inside payloads. */
export function readPsyqLib(bytes: Buffer): SdkMember[] {
  if (bytes.length >= 12 && bytes.toString("hex", 0, 4) === "4c494202") {
    let pos = bytes.readUInt32LE(4);
    const end = pos + bytes.readUInt32LE(8), result: SdkMember[] = [];
    if (pos < 12 || end > bytes.length) throw new Error("Invalid LIB v2 index extent");
    const need = (size: number) => { if (pos + size > end) throw new Error("Truncated LIB v2 index"); };
    const nameAt = (): string => {
      need(1); const length = bytes[pos++]! + 1; need(length);
      const name = bytes.toString("ascii", pos, pos + length).replace(/\0$/, ""); pos += length;
      if (!/^[\w.-]+$/.test(name)) throw new Error("Invalid LIB v2 name");
      return name;
    };
    while (pos < end) {
      need(12); const offset = bytes.readUInt32LE(pos), size = bytes.readUInt32LE(pos + 4); pos += 12;
      const name = nameAt();
      if (offset < 12 || offset + size > bytes.length) throw new Error("Invalid LIB v2 member extent");
      const data = bytes.subarray(offset, offset + size);
      if (data.toString("ascii", 0, 3) !== "LNK") throw new Error(`Non-LNK member ${name}`);
      result.push({ name, ordinal: result.length, offset, bytes: data });
      need(1); let more = bytes[pos++]!;
      while (more) { need(2); pos += 2; nameAt(); need(1); more = bytes[pos++]!; }
    }
    return result;
  }
  if (bytes.length < 4 || bytes.toString("hex", 0, 4) !== "4c494201") throw new Error("Unsupported PSY-Q LIB version");
  const result: SdkMember[] = [];
  for (let pos = 4; pos < bytes.length;) {
    if (pos + 20 > bytes.length) throw new Error(`Truncated LIB header at ${pos}`);
    const name = bytes.toString("ascii", pos, pos + 8).trim();
    const offset = bytes.readUInt32LE(pos + 12), size = bytes.readUInt32LE(pos + 16);
    if (!/^[\w.-]+$/.test(name) || offset < 20 || size <= offset || pos + size > bytes.length) throw new Error(`Invalid LIB member at ${pos}`);
    const data = bytes.subarray(pos + offset, pos + size);
    if (data.toString("ascii", 0, 3) !== "LNK") throw new Error(`Non-LNK member ${name}`);
    result.push({ name: `${name}.OBJ`, ordinal: result.length, offset: pos + offset, bytes: data });
    pos += size;
  }
  return result;
}

/** Read ar without extracting by name (GNU ar x also overwrites duplicates).
 * Handles GNU long-name tables and BSD extended names. */
export function readAr(bytes: Buffer): SdkMember[] {
  if (bytes.toString("ascii", 0, 8) !== "!<arch>\n") throw new Error("Invalid ar magic");
  const result: SdkMember[] = [];
  let names: Buffer = Buffer.alloc(0);
  for (let pos = 8; pos < bytes.length;) {
    if (pos + 60 > bytes.length || bytes.toString("ascii", pos + 58, pos + 60) !== "`\n") throw new Error("Truncated ar header");
    const sizeString = bytes.toString("ascii", pos + 48, pos + 58).trim();
    if (!/^\d+$/.test(sizeString)) throw new Error("Invalid ar size");
    const size = Number(sizeString), start = pos + 60;
    if (start + size + (size & 1) > bytes.length) throw new Error("Truncated ar member/padding");
    let name = bytes.toString("ascii", pos, pos + 16).trim(), data = bytes.subarray(start, start + size);
    if (name === "//") names = data;
    else if (name !== "/" && name !== "/SYM64/") {
      if (/^\/\d+$/.test(name)) {
        const index = Number(name.slice(1)), end = names.indexOf(Buffer.from("/\n"), index);
        if (index >= names.length || end < 0) throw new Error("Invalid ar long name");
        name = names.toString("ascii", index, end);
      } else if (name.startsWith("#1/")) {
        const length = Number(name.slice(3));
        if (!Number.isInteger(length) || length <= 0 || length > data.length) throw new Error("Invalid BSD ar name");
        name = data.toString("ascii", 0, length).replace(/\0+$/, "");
        data = data.subarray(length);
      } else name = name.replace(/\/$/, "");
      if (!/^[\w.-]+$/.test(name)) throw new Error(`Unsafe ar name ${name}`);
      result.push({ name, ordinal: result.length, offset: start, bytes: data });
    }
    pos = start + size + (size & 1);
  }
  return result;
}

export function collisionNames(members: { name: string; bytes: Buffer }[]): Set<string> {
  const groups = new Map<string, Set<string>>();
  for (const member of members) {
    const key = memberKey(member.name);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(hash(member.bytes));
  }
  return new Set([...groups].filter(([, contents]) => contents.size > 1).map(([name]) => name));
}

export interface TextObject {
  text: Buffer;
  symbols: { name: string; offset: number }[];
  relocationMask: Buffer;
  relocationCount: number;
}
export function readTextObject(bytes: Buffer): TextObject {
  const sections = elf32Sections(bytes);
  if (bytes[5] !== 1 || bytes.readUInt16LE(16) !== 1 || bytes.readUInt16LE(18) !== 8) throw new Error("Expected little-endian MIPS relocatable ELF");
  const text = sections.get(".text");
  if (!text || !text.size) throw new Error("No .text section");
  const symbols: TextObject["symbols"] = [];
  const symtab = sections.get(".symtab");
  if (symtab) {
    const strings = [...sections.values()].find(s => s.index === symtab.link)?.data;
    if (!strings || symtab.entsize !== 16 || symtab.size % 16) throw new Error("Invalid ELF symbol table");
    for (let i = 0; i < symtab.size; i += 16) {
      const sym = symtab.data.subarray(i, i + 16);
      if (sym.readUInt16LE(14) !== text.index || (sym[12]! >> 4) === 0) continue;
      const off = sym.readUInt32LE(0), end = strings.indexOf(0, off);
      if (end < 0 || off >= strings.length) throw new Error("Invalid ELF symbol name");
      symbols.push({ name: strings.toString("utf8", off, end), offset: sym.readUInt32LE(4) });
    }
  }
  const relocationMask = Buffer.alloc(text.size, 0xff);
  let relocationCount = 0;
  for (const section of sections.values()) {
    if (![4, 9].includes(section.type) || section.info !== text.index) continue;
    if (section.type !== 9 || section.entsize !== 8 || section.size % 8) throw new Error("Unsupported text relocations");
    for (let i = 0; i < section.size; i += 8) {
      const offset = section.data.readUInt32LE(i), type = section.data.readUInt32LE(i + 4) & 0xff;
      if (offset + 4 > text.size) throw new Error("Relocation outside .text");
      relocationCount++;
      if (type === 2) relocationMask.fill(0, offset, offset + 4); /* R_MIPS_32 */
      else if (type === 4) { /* R_MIPS_26: retain opcode */
        relocationMask.fill(0, offset, offset + 3); relocationMask[offset + 3] = 0xfc;
      } else if ([1, 5, 6, 7, 10].includes(type)) relocationMask.fill(0, offset, offset + 2);
      else throw new Error(`Unsupported MIPS relocation ${type}`);
    }
  }
  return { text: text.data, symbols, relocationMask, relocationCount };
}

export function parseSig(sig: string): { bytes: number[]; mask: boolean[] } {
  const tokens = sig.trim() ? sig.trim().split(/\s+/) : [];
  if (tokens.some(t => !/^(\?\?|[\da-f]{2})$/i.test(t))) throw new Error("Invalid signature byte");
  return { bytes: tokens.map(t => t === "??" ? 0 : parseInt(t, 16)), mask: tokens.map(t => t !== "??") };
}
export function signatureFits(entry: SigEntry, object: TextObject): boolean {
  const { bytes, mask } = parseSig(entry.sig);
  return bytes.length <= object.text.length && bytes.every((byte, i) => !mask[i] || byte === object.text[i]) &&
    (entry.labels ?? []).filter(l => !/^(loc_|text_)/.test(l.name)).every(l => object.symbols.some(s => s.name === l.name && s.offset === l.offset));
}
export function isReturnPadding(object: TextObject): boolean {
  return object.relocationCount === 0 && object.text.length >= 8 && object.text.length % 4 === 0 &&
    object.text.readUInt32LE(0) === 0x03e00008 && object.text.subarray(4).every(byte => byte === 0);
}

export function conventionalOPath(sigFile: string, name: string): { oPath: string; libDir: string } | null {
  const obj = memberKey(name);
  if (/\.LIB\.json$/i.test(sigFile)) {
    const libDir = sigFile.replace(/\.LIB\.json$/i, "").toLowerCase();
    return { oPath: `lib/${libDir}/${obj}.o`, libDir };
  }
  if (/\.OBJ\.json$/i.test(sigFile)) return { oPath: `lib/${obj}.o`, libDir: "" };
  return null;
}
export function loadMemberMap(root: string, version: string): MemberMap | null {
  const file = join(root, "build/sdk", `member-map-${version}.json`);
  if (!existsSync(file)) return null;
  const map: MemberMap = JSON.parse(readFileSync(file, "utf8"));
  if (map.schemaVersion !== 1 || map.version !== version || !Array.isArray(map.members) || !Array.isArray(map.signatures)) throw new Error(`Invalid SDK member map ${file}`);
  return map;
}
/** Never fall back to the ambiguous legacy filename for a collision. */
export function resolveSignatureObject(map: MemberMap | null, sigFile: string, entry: SigEntry, collision: boolean): { oPath: string; libDir: string } | null {
  const conventional = conventionalOPath(sigFile, entry.name);
  if (!conventional) return null;
  const identities = map?.signatures.filter(s => s.sigFile === sigFile && s.identity === signatureId(entry)) ?? [];
  if (identities.length === 1) return { oPath: identities[0]!.oPath, libDir: conventional.libDir };
  return collision ? null : conventional;
}
