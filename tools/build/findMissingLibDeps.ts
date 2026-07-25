/**
 * findMissingLibDeps.ts — Find unmatched library .o files needed by matched ones
 *
 * Matched library .o files (from detectLibFunctions) reference symbols defined
 * in OTHER library .o files that weren't detected by signature matching.
 * This tool finds those missing dependencies and resolves their VRAM addresses
 * by reading relocations from matched .o files and decoding call targets from
 * the actual binary.
 *
 * Usage:
 *   npx tsx tools/build/findMissingLibDeps.ts
 *
 * Output (stdout): JSON array of resolved symbols with VRAM addresses
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();

const BINARY_PATH = _info.binaryPath;
const PAYLOAD_OFFSET = _info.payloadOffset;
const LOAD_ADDR = _info.loadAddr;

interface LibMatch {
  vramStart: number;
  vramEnd: number;
  oPath: string;
  textSize: number;
  sigLength: number;
  labels: { name: string; vramAddr: number }[];
  libName: string;
  objName: string;
}

interface ResolvedSymbol {
  name: string;
  vramAddr: number;
  type: string; // "func" or "data"
  definedIn: string; // .o path that defines it
  referencedBy: string[]; // .o paths that reference it
}

function vramToFileOffset(vram: number): number {
  return vram - LOAD_ADDR + PAYLOAD_OFFSET;
}

function main() {
  // Get matched .o files
  console.error("Running detectLibFunctions.ts...");
  const detectOutput = execSync("npx tsx tools/build/detectLibFunctions.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
  const matches: LibMatch[] = JSON.parse(detectOutput);
  const matchedPaths = new Set(matches.map((m) => m.oPath));

  // Build map of matched .o path -> match info
  const matchByPath = new Map<string, LibMatch>();
  for (const m of matches) matchByPath.set(m.oPath, m);

  // Also build set of all symbols defined by matched .o files
  const matchedSymbols = new Set<string>();
  for (const m of matches) {
    for (const l of m.labels) matchedSymbols.add(l.name);
    // Also get all global symbols from the .o file itself
    try {
      const nm = execSync(
        `mips-linux-gnu-nm --defined-only "${m.oPath}" 2>/dev/null`,
        { encoding: "utf-8", cwd: ROOT }
      );
      for (const line of nm.split("\n")) {
        const match = line.match(/[0-9a-f]+\s+[TDBRCS]\s+(\S+)/);
        if (match) matchedSymbols.add(match[1]);
      }
    } catch {}
  }

  // Collect all undefined symbols from matched .o files
  const undefSyms = new Map<string, Set<string>>(); // symbol -> set of .o files referencing it

  for (const m of matches) {
    try {
      const nm = execSync(`mips-linux-gnu-nm -u "${m.oPath}" 2>/dev/null`, {
        encoding: "utf-8",
        cwd: ROOT,
      });
      for (const line of nm.split("\n")) {
        const match = line.match(/U\s+(\S+)/);
        if (match) {
          const sym = match[1];
          // Skip symbols defined by other matched .o files
          if (matchedSymbols.has(sym)) continue;
          if (!undefSyms.has(sym)) undefSyms.set(sym, new Set());
          undefSyms.get(sym)!.add(m.oPath);
        }
      }
    } catch {}
  }

  console.error(`Undefined symbols from matched .o files: ${undefSyms.size}`);

  // Find which archive members define each undefined symbol
  const symDefInfo = new Map<
    string,
    { archive: string; member: string; oPath: string; type: string }
  >();

  const archives = execSync("ls lib/*.a", { encoding: "utf-8", cwd: ROOT })
    .trim()
    .split("\n");

  for (const archive of archives) {
    try {
      const nm = execSync(
        `mips-linux-gnu-nm --print-file-name "${archive}" 2>/dev/null`,
        { encoding: "utf-8", cwd: ROOT }
      );
      for (const line of nm.split("\n")) {
        const m = line.match(
          /^(.+\.a):(.+\.o):[0-9a-f]+\s+([TDBRCS])\s+(\S+)$/
        );
        if (!m) continue;
        const [, archivePath, member, type, sym] = m;
        if (undefSyms.has(sym) && !symDefInfo.has(sym)) {
          const libDir = archivePath.replace(/\.a$/, "").replace(/^lib\//, "");
          const oPath = `lib/${libDir}/${member}`;
          symDefInfo.set(sym, {
            archive: archivePath,
            member,
            oPath,
            type: type === "T" ? "func" : "data",
          });
        }
      }
    } catch {}
  }

  // Now resolve VRAM addresses by reading relocations from matched .o files
  // and decoding the corresponding instructions in the binary
  const binary = readFileSync(BINARY_PATH);
  const resolved: ResolvedSymbol[] = [];

  for (const [sym, refs] of undefSyms) {
    const defInfo = symDefInfo.get(sym);
    if (!defInfo) {
      console.error(`  WARNING: ${sym} not found in any archive`);
      continue;
    }

    const refPaths = [...refs];
    let vramAddr: number | null = null;

    // Try to resolve by reading relocations from a referencing .o file
    for (const refPath of refPaths) {
      const matchInfo = matchByPath.get(refPath);
      if (!matchInfo) continue;

      try {
        // Get relocations for this symbol in the referencing .o
        const relocs = execSync(
          `mips-linux-gnu-readelf -r "${refPath}" 2>/dev/null`,
          { encoding: "utf-8", cwd: ROOT }
        );

        // Extract .text bytes from the .o file for reading addends
        let oTextBytes: Buffer | null = null;
        try {
          const tmpPath = "/tmp/findMissingLibDeps_text.bin";
          execSync(
            `mips-linux-gnu-objcopy -O binary -j .text "${refPath}" "${tmpPath}" 2>/dev/null`,
            { cwd: ROOT }
          );
          oTextBytes = readFileSync(tmpPath);
        } catch {}

        for (const line of relocs.split("\n")) {
          // Match relocation entries referencing our symbol
          // Format: OFFSET  INFO  TYPE  SYM.VALUE  SYM. NAME + ADDEND
          if (!line.includes(sym)) continue;

          const relocMatch = line.match(
            /^([0-9a-f]+)\s+[0-9a-f]+\s+(\S+)\s+[0-9a-f]+\s+(\S+)/
          );
          if (!relocMatch) continue;

          const offset = parseInt(relocMatch[1], 16);
          const relocType = relocMatch[2];
          const relocSym = relocMatch[3];

          // Only handle symbols that match exactly
          if (relocSym !== sym) continue;

          // Read the instruction at this offset in the binary
          const binaryOffset =
            vramToFileOffset(matchInfo.vramStart) + offset;

          if (relocType === "R_MIPS_26") {
            // JAL/J instruction: target = (instr & 0x03FFFFFF) << 2
            const instr = binary.readUInt32LE(binaryOffset);
            const target = (((instr & 0x03ffffff) << 2) | 0x80000000) >>> 0;
            vramAddr = target;
            break;
          } else if (
            relocType === "R_MIPS_HI16" ||
            relocType === "R_MIPS_LO16"
          ) {
            if (relocType === "R_MIPS_HI16") {
              const hiInstr = binary.readUInt32LE(binaryOffset);
              const hiImm = hiInstr & 0xffff;

              // Look for the matching LO16
              for (const line2 of relocs.split("\n")) {
                if (!line2.includes(sym)) continue;
                const loMatch = line2.match(
                  /^([0-9a-f]+)\s+[0-9a-f]+\s+R_MIPS_LO16\s+[0-9a-f]+\s+(\S+)/
                );
                if (!loMatch || loMatch[2] !== sym) continue;

                const loOffset = parseInt(loMatch[1], 16);
                const loBinaryOffset =
                  vramToFileOffset(matchInfo.vramStart) + loOffset;
                const loInstr = binary.readUInt32LE(loBinaryOffset);
                const loImm = loInstr & 0xffff;
                const signedLo = loImm > 0x7fff ? loImm - 0x10000 : loImm;

                let addr = ((hiImm << 16) + signedLo) >>> 0;

                // Subtract addend from .o file instructions
                if (oTextBytes && offset + 4 <= oTextBytes.length && loOffset + 4 <= oTextBytes.length) {
                  const hiOrig = oTextBytes.readUInt32LE(offset);
                  const loOrig = oTextBytes.readUInt32LE(loOffset);
                  const hiAdd = hiOrig & 0xffff;
                  const loAdd = loOrig & 0xffff;
                  const signedLoAdd = loAdd > 0x7fff ? loAdd - 0x10000 : loAdd;
                  const addend = (hiAdd << 16) + signedLoAdd;
                  if (addend !== 0) {
                    addr = (addr - addend) >>> 0;
                  }
                }

                vramAddr = addr;
                break;
              }
              if (vramAddr !== null) break;
            }
          }
        }
      } catch {}

      if (vramAddr !== null) break;
    }

    if (vramAddr !== null) {
      resolved.push({
        name: sym,
        vramAddr,
        type: defInfo.type,
        definedIn: defInfo.oPath,
        referencedBy: refPaths,
      });
    } else {
      console.error(
        `  UNRESOLVED: ${sym} (defined in ${defInfo.oPath}, referenced by ${refPaths.join(", ")})`
      );
    }
  }

  // Sort by address
  resolved.sort((a, b) => a.vramAddr - b.vramAddr);

  console.error(`\nResolved: ${resolved.length}/${undefSyms.size} symbols`);
  for (const r of resolved) {
    console.error(
      `  0x${r.vramAddr.toString(16).padStart(8, "0")} ${r.name} (${r.type}) from ${r.definedIn}`
    );
  }

  // Output JSON to stdout
  console.log(JSON.stringify(resolved, null, 2));
}

main();
