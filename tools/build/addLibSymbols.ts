/**
 * addLibSymbols.ts — Add PSY-Q library function labels to symbol_addrs.txt
 *
 * Runs detectLibFunctions.ts to get matched library objects with their named
 * function labels, then merges those labels into configs/symbol_addrs.txt so
 * that splat uses real function names in disassembly output.
 *
 * Usage:
 *   npx tsx tools/build/addLibSymbols.ts           # dry run
 *   npx tsx tools/build/addLibSymbols.ts --write   # update symbol_addrs.txt
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, ROOT } from "../lib/psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const SYMBOLS_PATH = join(ROOT, "configs/symbol_addrs.txt");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SRC_DIR = join(ROOT, "src");

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

function main() {
  const writeMode = process.argv.includes("--write");

  // Run detectLibFunctions.ts and parse its JSON output
  console.log("Running detectLibFunctions.ts...");
  const output = execSync("npx tsx tools/build/detectLibFunctions.ts", {
    encoding: "utf-8",
    cwd: ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });

  // stdout has JSON, stderr has summary (already printed by inherit)
  const matches: LibMatch[] = JSON.parse(output);

  // Collect all labels
  const newLabels: { name: string; vram: number; type: string }[] = [];
  for (const m of matches) {
    for (const l of m.labels) {
      newLabels.push({ name: l.name, vram: l.vramAddr, type: "func" });
    }
  }

  console.log(`Found ${newLabels.length} library function labels`);

  // Also run findMissingLibDeps.ts to get cross-referenced symbols
  console.log("Running findMissingLibDeps.ts...");
  try {
    const depsOutput = execSync("npx tsx tools/build/findMissingLibDeps.ts", {
      encoding: "utf-8",
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });

    interface ResolvedSymbol {
      name: string;
      vramAddr: number;
      type: string;
      definedIn: string;
      referencedBy: string[];
    }

    const depSyms: ResolvedSymbol[] = JSON.parse(depsOutput);
    for (const s of depSyms) {
      newLabels.push({ name: s.name, vram: s.vramAddr, type: s.type === "func" ? "depfunc" : "data" });
    }
    console.log(`Found ${depSyms.length} cross-referenced dependency symbols`);
  } catch (e) {
    console.error("Warning: findMissingLibDeps.ts failed, skipping dependency symbols");
  }

  // Run resolveLibSections.ts to get data/rdata section positions for matched .o files.
  // Use these to compute data symbol addresses and add them as labels.
  // This enables detectLibFunctions (in patchSplatForLibs) to verify wrapper placements.
  console.log("Running resolveLibSections.ts for data symbol addresses...");
  try {
    interface LibSections {
      oPath: string;
      textRom: number;
      textSize: number;
      rdataRom?: number;
      rdataSize?: number;
      dataRom?: number;
      dataSize?: number;
    }

    const sectionsOutput = execSync("npx tsx tools/build/resolveLibSections.ts", {
      encoding: "utf-8",
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    const libSections: LibSections[] = JSON.parse(sectionsOutput);
    let dataSymCount = 0;

    for (const ls of libSections) {
      // Process .data and .rdata sections
      for (const { secName, secRom } of [
        { secName: ".data", secRom: ls.dataRom },
        { secName: ".rdata", secRom: ls.rdataRom },
      ]) {
        if (secRom === undefined || secRom <= 0) continue;
        const secVram = secRom - _info.payloadOffset + _info.loadAddr;

        // Get global data/rdata symbols from nm
        try {
          const nmOutput = execSync(`mips-linux-gnu-nm "${ls.oPath}" 2>/dev/null`, {
            encoding: "utf-8",
            cwd: ROOT,
          });
          for (const line of nmOutput.split("\n")) {
            const m = line.match(/^([0-9a-f]+)\s+([DR])\s+(\S+)/);
            if (!m) continue;
            const offset = parseInt(m[1], 16);
            const symType = m[2];
            const name = m[3];
            // D = global .data, R = global .rdata (uppercase only = global)
            if ((symType === "D" && secName === ".data") ||
                (symType === "R" && secName === ".rdata")) {
              const vram = secVram + offset;
              newLabels.push({ name, vram, type: "data" });
              dataSymCount++;
            }
          }
        } catch {}
      }
    }
    console.log(`Found ${dataSymCount} data symbols from matched .o sections`);
  } catch (e) {
    console.error("Warning: resolveLibSections.ts failed, skipping data symbols");
  }

  // Parse existing symbol_addrs.txt
  let existingContent = readFileSync(SYMBOLS_PATH, "utf-8");
  const existingNames = new Set<string>();
  const existingAddrs = new Set<number>();
  const existingNameToAddr = new Map<string, number>();

  for (const line of existingContent.split("\n")) {
    const nameMatch = line.match(/^(\S+)\s*=/);
    if (nameMatch) existingNames.add(nameMatch[1]);
    const addrMatch = line.match(/=\s*0x([0-9A-Fa-f]+)/);
    if (addrMatch) existingAddrs.add(parseInt(addrMatch[1], 16));
    if (nameMatch && addrMatch) {
      existingNameToAddr.set(nameMatch[1], parseInt(addrMatch[1], 16));
    }
  }

  // Deduplicate new labels by address (first occurrence wins — detection labels come first)
  const seenAddrs = new Set<number>();
  const seenNames = new Set<string>();
  const dedupedLabels = newLabels.filter((l) => {
    if (seenAddrs.has(l.vram) || seenNames.has(l.name)) return false;
    seenAddrs.add(l.vram);
    seenNames.add(l.name);
    return true;
  });

  // Update stale library symbol addresses: if a detection label has a name that
  // exists in symbol_addrs.txt but at a different address, correct it.
  // Also remove entries whose address is now claimed by a different symbol.
  if (writeMode) {
    let updatedCount = 0;
    const lines = existingContent.split("\n");

    // Build map of correct name→addr from detection
    const correctAddrs = new Map<string, number>();
    for (const l of dedupedLabels) {
      correctAddrs.set(l.name, l.vram);
    }

    // Build set of all addresses claimed by detection labels
    const detectedAddrs = new Map<number, string>();
    for (const l of dedupedLabels) {
      detectedAddrs.set(l.vram, l.name);
    }

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\S+)\s*=\s*0x([0-9A-Fa-f]+)/);
      if (!m) continue;
      const name = m[1];
      const addr = parseInt(m[2], 16);

      // Case 1: This name is in detection results but at a different address
      const correctAddr = correctAddrs.get(name);
      if (correctAddr !== undefined && correctAddr !== addr) {
        const newAddrHex = `0x${correctAddr.toString(16).toUpperCase()}`;
        const oldAddrHex = `0x${addr.toString(16).toUpperCase()}`;
        lines[i] = lines[i].replace(new RegExp(`0x${m[2]}`, "i"), newAddrHex);
        console.log(`  Updated ${name}: ${oldAddrHex} → ${newAddrHex}`);
        updatedCount++;
        // Update tracking sets
        existingAddrs.delete(addr);
        existingAddrs.add(correctAddr);
        existingNameToAddr.set(name, correctAddr);

        // Rename c segment and source file at old address back to generic name
        const oldVramHex = addr.toString(16).toUpperCase();
        const genericName = `func_${oldVramHex}`;
        let yamlContent = readFileSync(SPLAT_YAML, "utf-8");
        if (yamlContent.includes(`, c, ${name}]`)) {
          yamlContent = yamlContent.replace(
            new RegExp(`(,\\s*c,\\s*)${name}\\]`, "g"),
            `$1${genericName}]`
          );
          writeFileSync(SPLAT_YAML, yamlContent);
          console.log(`  Reverted c segment: ${name} → ${genericName} in YAML`);
        }
        const oldSrc = join(SRC_DIR, `${name}.c`);
        const newSrc = join(SRC_DIR, `${genericName}.c`);
        if (existsSync(oldSrc) && !existsSync(newSrc)) {
          let content = readFileSync(oldSrc, "utf-8");
          content = content.replace(new RegExp(name, "g"), genericName);
          writeFileSync(oldSrc, content);
          renameSync(oldSrc, newSrc);
          console.log(`  Renamed ${name}.c → ${genericName}.c`);
        }
        continue;
      }

      // Case 2: This address is now claimed by a different detection label
      const claimant = detectedAddrs.get(addr);
      // Only auto-generated names (func_XXXXXXXX) may be garbage-collected.
      // A hand-chosen name at a detection-claimed address is a deliberate
      // rename of a library symbol and must WIN — same "existing entries
      // win" semantics as the add filter below. Without this guard, lib
      // renames silently revert on the next split.
      if (
        claimant &&
        claimant !== name &&
        !correctAddrs.has(name) &&
        /^func_[0-9A-Fa-f]{8}$/.test(name)
      ) {
        // This entry's address belongs to a different symbol now — remove it
        console.log(`  Removing stale ${name} at 0x${addr.toString(16).toUpperCase()} (now ${claimant})`);
        lines.splice(i, 1);
        i--;
        updatedCount++;
        existingNames.delete(name);
        existingAddrs.delete(addr);
        existingNameToAddr.delete(name);
      }
    }

    if (updatedCount > 0) {
      existingContent = lines.join("\n");
      writeFileSync(SYMBOLS_PATH, existingContent);
      console.log(`Updated ${updatedCount} stale symbol entries`);
      // Refresh tracking sets
      existingNames.clear();
      existingAddrs.clear();
      for (const line of existingContent.split("\n")) {
        const nameMatch = line.match(/^(\S+)\s*=/);
        if (nameMatch) existingNames.add(nameMatch[1]);
        const addrMatch = line.match(/=\s*0x([0-9A-Fa-f]+)/);
        if (addrMatch) existingAddrs.add(parseInt(addrMatch[1], 16));
      }
    }
  }

  // Fix misnamed c segments in YAML: if a c segment's name is a known symbol
  // but the symbol's address doesn't match the segment's ROM, rename it back
  if (writeMode) {
    // Build name→vram from current symbol_addrs.txt
    const symNameToVram = new Map<string, number>();
    for (const line of existingContent.split("\n")) {
      const m = line.match(/^(\S+)\s*=\s*0x([0-9A-Fa-f]+)/);
      if (m) symNameToVram.set(m[1], parseInt(m[2], 16));
    }

    let yamlContent = readFileSync(SPLAT_YAML, "utf-8");
    let fixedCount = 0;
    const cSegRe = /^(\s+- \[)(0x[0-9A-Fa-f]+)(,\s*c,\s*)(\S+?)(\].*)$/gm;
    yamlContent = yamlContent.replace(cSegRe, (match, pre, romHex, mid, name, post) => {
      const segRom = parseInt(romHex, 16);
      const segVram = segRom - _info.payloadOffset + _info.loadAddr;
      const symVram = symNameToVram.get(name);
      // If name is a known symbol but at a different VRAM, revert to generic
      if (symVram !== undefined && symVram !== segVram && !name.startsWith("func_")) {
        const genericName = `func_${segVram.toString(16).toUpperCase()}`;
        console.log(`  Fix c segment: ${name} at ROM ${romHex} → ${genericName} (symbol is at 0x${symVram.toString(16).toUpperCase()})`);
        // Also rename source file
        const oldSrc = join(SRC_DIR, `${name}.c`);
        const newSrc = join(SRC_DIR, `${genericName}.c`);
        if (existsSync(oldSrc) && !existsSync(newSrc)) {
          let content = readFileSync(oldSrc, "utf-8");
          content = content.replace(new RegExp(name, "g"), genericName);
          writeFileSync(oldSrc, content);
          renameSync(oldSrc, newSrc);
          console.log(`  Renamed ${name}.c → ${genericName}.c`);
        }
        fixedCount++;
        return `${pre}${romHex}${mid}${genericName}${post}`;
      }
      return match;
    });
    if (fixedCount > 0) {
      writeFileSync(SPLAT_YAML, yamlContent);
      console.log(`Fixed ${fixedCount} misnamed c segments in YAML`);
    }
  }

  // Filter to only new entries (don't overwrite existing)
  const toAdd = dedupedLabels.filter(
    (l) => !existingNames.has(l.name) && !existingAddrs.has(l.vram)
  );
  const skipped = newLabels.length - toAdd.length;

  console.log(`  New labels to add: ${toAdd.length}`);
  if (skipped > 0) {
    console.log(`  Skipped (already exist): ${skipped}`);
  }

  // For dependency func symbols: rename c segments in splat.yaml and src/*.c files
  // so splat generates asm with matching names.
  // Use dedupedLabels (not toAdd) so we also rename for entries already in symbol_addrs.txt.
  const depFuncRenames = dedupedLabels.filter((l) => l.type === "depfunc");
  if (depFuncRenames.length > 0 && writeMode) {
    let yamlContent = readFileSync(SPLAT_YAML, "utf-8");
    let renamedCount = 0;
    for (const l of depFuncRenames) {
      const addrHex = l.vram.toString(16).toUpperCase();
      const oldName = `func_${addrHex}`;

      // Rename in splat.yaml: "c, func_XXXXXXXX]" → "c, <realname>]"
      yamlContent = yamlContent.replace(
        new RegExp(`(,\\s*c,\\s*)${oldName}\\]`, "g"),
        `$1${l.name}]`
      );

      // Rename src/func_XXXXXXXX.c → src/<realname>.c and update INCLUDE_ASM inside
      const oldSrc = join(SRC_DIR, `${oldName}.c`);
      const newSrc = join(SRC_DIR, `${l.name}.c`);
      if (existsSync(oldSrc) && !existsSync(newSrc)) {
        let content = readFileSync(oldSrc, "utf-8");
        content = content.replace(
          new RegExp(oldName, "g"),
          l.name
        );
        writeFileSync(oldSrc, content);
        renameSync(oldSrc, newSrc);
        console.log(`  Renamed ${oldName}.c → ${l.name}.c`);
        renamedCount++;
      }
    }
    writeFileSync(SPLAT_YAML, yamlContent);
    console.log(`Renamed ${renamedCount} c segments/files for dependency func symbols`);
  }

  if (toAdd.length === 0) {
    console.log("Nothing to add to symbol_addrs.txt.");
    return;
  }

  if (!writeMode) {
    console.log("\nDry run. Run with --write to update symbol_addrs.txt");
    for (const l of toAdd.slice(0, 20)) {
      console.log(
        `  ${l.name} = 0x${l.vram.toString(16).toUpperCase()};${l.type === "func" ? " // type:func" : ""}`
      );
    }
    if (toAdd.length > 20) {
      console.log(`  ... and ${toAdd.length - 20} more`);
    }
    return;
  }

  // Merge into existing content: parse all lines, insert new entries sorted by address
  const lines = existingContent.split("\n");

  // Build list of new lines
  const newLines = toAdd.map((l) => {
    const addr = `0x${l.vram.toString(16).toUpperCase()}`;
    if (l.type === "func") {
      return `${l.name} = ${addr}; // type:func`;
    }
    // Data symbols: no type annotation (splat doesn't support generic "data" type)
    return `${l.name} = ${addr};`;
  });

  // Insert each new line in sorted position by address
  for (const newLine of newLines) {
    const addrMatch = newLine.match(/=\s*0x([0-9A-Fa-f]+)/);
    if (!addrMatch) continue;
    const addr = parseInt(addrMatch[1], 16);

    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/=\s*0x([0-9A-Fa-f]+)/);
      if (m && parseInt(m[1], 16) > addr) {
        lines.splice(i, 0, newLine);
        inserted = true;
        break;
      }
    }
    if (!inserted) lines.push(newLine);
  }

  writeFileSync(SYMBOLS_PATH, lines.join("\n"));
  console.log(`Updated ${SYMBOLS_PATH} with ${toAdd.length} new entries`);
}

main();
