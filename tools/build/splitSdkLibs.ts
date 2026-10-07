#!/usr/bin/env npx tsx
/** Recover colliding SDK members without last-write-wins extraction.
 * Usage: splitSdkLibs.ts [--write] [--converter /path/to/psyq2elf]
 *   [--sdk-dir tools/vendor/psyq47/LIB] [--version 470]
 * Existing non-colliding objects (including BSS patches) are not rewritten.
 * Generated objects/map are reproducible outputs, not checked-in artifacts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { collisionNames, hash, loadMemberMap, memberKey, readAr, readPsyqLib, readTextObject, signatureFits, signatureId, type MemberMap, type MemberRecord, type SigEntry } from "../lib/psyqMembers.js";
import { ROOT } from "../lib/psxExeInfo.js";

export interface SplitOptions { root: string; sdkDir: string; version: string; converter?: string; write: boolean }
function writeChanged(file: string, bytes: Buffer | string): void {
  const data = Buffer.from(bytes);
  if (existsSync(file) && readFileSync(file).equals(data)) return;
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, data);
}

export function splitSdkLibs(options: SplitOptions): MemberMap {
  const { root, sdkDir, version, write } = options;
  if (!/^\d+$/.test(version)) throw new Error("SDK version must be a numeric directory name");
  const scratch = mkdtempSync(join(tmpdir(), "psyq-members-"));
  const map: MemberMap = { schemaVersion: 1, version, members: [], signatures: [] };
  const pending = new Map<string, Buffer>();
  const previous = loadMemberMap(root, version);
  try {
    for (const file of readdirSync(sdkDir).filter(f => /\.(LIB|a)$/i.test(f)).sort()) {
      const source = join(sdkDir, file), archive = readFileSync(source);
      const original = /\.LIB$/i.test(file);
      const members = original ? readPsyqLib(archive) : readAr(archive);
      const collisions = collisionNames(members);
      const lib = basename(file).replace(/\.(LIB|a)$/i, "").toLowerCase();
      const used = new Map<string, string>();
      for (const member of members) {
        const key = memberKey(member.name), collision = collisions.has(key);
        let oPath = `lib/${lib}/${key}.o`;
        let elf: Buffer;
        if (collision && original) {
          // Reuse only an ordinal+content-identified member, never a bare name.
          const cached = previous?.members.find(m => m.source === relative(root, source) && m.ordinal === member.ordinal && m.sourceHash === hash(member.bytes));
          if (cached && existsSync(join(root, cached.oPath))) elf = readFileSync(join(root, cached.oPath));
          else {
            // Convert independently, BEFORE choosing a symbol-qualified filename.
            if (!options.converter) throw new Error(`${file}:${member.name} collides; set PSYQ2ELF or --converter to a built psyq2elf executable`);
            const input = join(scratch, `${member.ordinal}.OBJ`), output = join(scratch, `${member.ordinal}.o`);
            writeFileSync(input, member.bytes);
            execFileSync(options.converter, [input, output], { stdio: ["ignore", "pipe", "pipe"] });
            elf = readFileSync(output);
          }
        } else if (original) {
          if (!existsSync(join(root, oPath))) continue; // Missing objects stay explicit at detection.
          elf = readFileSync(join(root, oPath));
        } else elf = member.bytes;

        let symbols: MemberRecord["symbols"] = [];
        try { symbols = readTextObject(elf).symbols; } catch (error) {
          if (collision) throw error; // A collision without inspectable .text cannot be named safely.
        }
        if (collision) {
          const first = symbols[0]?.name ?? hash(member.bytes).slice(0, 12);
          const safe = first.replace(/[^\w.-]/g, "_");
          oPath = `build/sdk/lib/${version}/${lib}/${key}__${safe}.o`;
          if (used.has(oPath) && used.get(oPath) !== hash(member.bytes)) oPath = oPath.replace(/\.o$/, `__${hash(member.bytes).slice(0, 12)}.o`);
          pending.set(oPath, elf);
        } else if (!original && !existsSync(join(root, oPath))) {
          oPath = `build/sdk/lib/${version}/${lib}/${key}.o`;
          pending.set(oPath, elf);
        }
        const identity = hash(member.bytes);
        if (used.has(oPath) && used.get(oPath) !== identity) throw new Error(`Output collision ${oPath}`);
        used.set(oPath, identity);
        map.members.push({ source: relative(root, source), member: member.name, ordinal: member.ordinal, sourceOffset: member.offset, sourceHash: identity, symbols, oPath, collision });
      }
    }
    const sigDir = join(root, "tools/vendor/psx_psyq_signatures", version);
    for (const sigFile of readdirSync(sigDir).filter(f => f.endsWith(".LIB.json")).sort()) {
      const lib = sigFile.replace(/\.LIB\.json$/i, "").toLowerCase();
      const entries: SigEntry[] = JSON.parse(readFileSync(join(sigDir, sigFile), "utf8"));
      for (const entry of entries) {
        const records = map.members.filter(m => basename(m.source).replace(/\.(LIB|a)$/i, "").toLowerCase() === lib && memberKey(m.member) === memberKey(entry.name));
        const paths = [...new Set(records.map(m => m.oPath))];
        const matches = paths.filter(p => {
          try { return signatureFits(entry, readTextObject(pending.get(p) ?? readFileSync(join(root, p)))); } catch { return false; }
        });
        if (matches.length === 1) map.signatures.push({ sigFile, identity: signatureId(entry), oPath: matches[0]! });
        else if (records.some(m => m.collision)) throw new Error(`Cannot uniquely map ${sigFile}:${entry.name} (${entry.labels?.[0]?.name}): ${matches.length} verified objects`);
      }
    }
    if (write) {
      for (const [oPath, elf] of pending) writeChanged(join(root, oPath), elf);
      writeChanged(join(root, "build/sdk", `member-map-${version}.json`), JSON.stringify(map, null, 2) + "\n");
    }
    return map;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
function main(): void {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string): string => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    if (!args[i + 1] || args[i + 1]!.startsWith("--")) throw new Error(`Missing value for ${name}`);
    return args[i + 1]!;
  };
  const converter = option("--converter", process.env.PSYQ2ELF ?? "");
  const map = splitSdkLibs({ root: ROOT, sdkDir: option("--sdk-dir", join(ROOT, "tools/vendor/psyq47/LIB")), version: option("--version", "470"), write: args.includes("--write"), ...(converter ? { converter } : {}) });
  const collisionPaths = new Set(map.members.filter(m => m.collision).map(m => m.oPath));
  console.log(`${args.includes("--write") ? "Wrote" : "Dry run:"} SDK ${map.version}: ${map.members.length} members, ${collisionPaths.size} collision-safe objects, ${map.signatures.length} signature mappings`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
