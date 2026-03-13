/**
 * addLibSymbols.ts — Add PSY-Q library function labels to symbol_addrs.txt
 *
 * Runs detectLibFunctions.ts to get matched library objects with their named
 * function labels, then merges those labels into configs/symbol_addrs.txt so
 * that splat uses real function names in disassembly output.
 *
 * Usage:
 *   npx tsx tools/addLibSymbols.ts           # dry run
 *   npx tsx tools/addLibSymbols.ts --write   # update symbol_addrs.txt
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
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
  const output = execSync("npx tsx tools/detectLibFunctions.ts", {
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
    const depsOutput = execSync("npx tsx tools/findMissingLibDeps.ts", {
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

  // Parse existing symbol_addrs.txt
  const existingContent = readFileSync(SYMBOLS_PATH, "utf-8");
  const existingNames = new Set<string>();
  const existingAddrs = new Set<number>();

  for (const line of existingContent.split("\n")) {
    const nameMatch = line.match(/^(\S+)\s*=/);
    if (nameMatch) existingNames.add(nameMatch[1]);
    const addrMatch = line.match(/=\s*0x([0-9A-Fa-f]+)/);
    if (addrMatch) existingAddrs.add(parseInt(addrMatch[1], 16));
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
