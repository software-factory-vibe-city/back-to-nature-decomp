/**
 * fixCrossFileRefs.ts
 *
 * After `make split`, scans all generated .s files in build/asm/ to find
 * cross-file label references. When a symbol is referenced in one file but
 * defined (without global visibility) in another, adds it to symbol_addrs.txt
 * with `type:func` so that spimdisasm will emit it with `glabel` on the
 * next `make split`.
 *
 * Usage:
 *   npx tsx tools/fixCrossFileRefs.ts           # dry run
 *   npx tsx tools/fixCrossFileRefs.ts --write   # update symbol_addrs.txt
 *
 * Intended workflow:
 *   make split
 *   npx tsx tools/fixCrossFileRefs.ts --write
 *   make split   # re-split with fixed symbols
 *   make         # should link cleanly
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, requireSectionLayout, ROOT } from "./psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const _layout = requireSectionLayout();
const ASM_DIR = join(ROOT, "build/asm");
const SYMBOLS_PATH = join(ROOT, "configs/symbol_addrs.txt");

const LOAD_ADDR = _info.loadAddr;
const HEADER_SIZE = _info.payloadOffset;
const TEXT_START = _layout.textStart - _info.payloadOffset + _info.loadAddr;
const TEXT_END = _layout.dataStart - _info.payloadOffset + _info.loadAddr;

// Patterns for labels defined in a file
// glabel/alabel = global, plain "  label:" or "  .Laddr:" = local
const GLABEL_RE = /^(?:glabel|alabel)\s+(\S+)/;
const LOCAL_LABEL_DEF_RE = /^\s+(\S+):\s*$/;

// Patterns for symbol references in instructions
// Matches branch/jump targets and jal targets at end of line
const SYMBOL_REF_RE =
  /\b(?:b|beq|bne|bgtz|bltz|bgez|blez|bgezal|bltzal|bc1f|bc1t|j|jal)\s+(\S+)\s*$/;
// Also catch "b  label" with extra spaces (mips asm)
const BRANCH_OPERAND_RE =
  /,\s+(\.?L?(?:func_|label_|jtbl_)?[0-9A-Fa-f]{8})\s*$/;

function scanFile(path: string): {
  globalDefs: Set<string>;
  localDefs: Set<string>;
  refs: Set<string>;
} {
  const content = readFileSync(path, "utf-8");
  const globalDefs = new Set<string>();
  const localDefs = new Set<string>();
  const refs = new Set<string>();

  for (const line of content.split("\n")) {
    // Check for global label definitions
    const globalMatch = line.match(GLABEL_RE);
    if (globalMatch) {
      globalDefs.add(globalMatch[1]);
      continue;
    }

    // Check for local label definitions (indented, bare "label:")
    const localMatch = line.match(LOCAL_LABEL_DEF_RE);
    if (localMatch) {
      localDefs.add(localMatch[1]);
      continue;
    }

    // Skip non-instruction lines
    if (!line.includes("/*")) continue;

    // Check for symbol references in instructions
    const instrPart = line.replace(/\/\*.*?\*\//, "").trim();
    const refMatch = instrPart.match(SYMBOL_REF_RE);
    if (refMatch) {
      refs.add(refMatch[1]);
      continue;
    }

    // Check for branch with comma-separated operand (beq $a0, $zero, .Laddr)
    const branchMatch = instrPart.match(BRANCH_OPERAND_RE);
    if (branchMatch) {
      refs.add(branchMatch[1]);
    }
  }

  return { globalDefs, localDefs, refs };
}

// Scan all .s files (top-level + nonmatchings subdirectories)
const topFiles = readdirSync(ASM_DIR)
  .filter((f) => f.endsWith(".s"))
  .map((f) => join(ASM_DIR, f));

const nonmatchDir = join(ASM_DIR, "nonmatchings");
let nmFiles: string[] = [];
try {
  const subdirs = readdirSync(nonmatchDir);
  for (const sub of subdirs) {
    const subPath = join(nonmatchDir, sub);
    try {
      const sFiles = readdirSync(subPath)
        .filter((f) => f.endsWith(".s"))
        .map((f) => join(subPath, f));
      nmFiles.push(...sFiles);
    } catch {}
  }
} catch {}

const files = [...topFiles, ...nmFiles];

console.log(`Scanning ${files.length} assembly files...`);

// Build maps: symbol -> defining file, symbol -> is global
const definedIn = new Map<string, string>();
const isGlobal = new Map<string, boolean>();
const allRefs = new Map<string, Set<string>>(); // symbol -> set of files referencing it

for (const file of files) {
  const { globalDefs, localDefs, refs } = scanFile(file);

  for (const sym of globalDefs) {
    definedIn.set(sym, file);
    isGlobal.set(sym, true);
  }
  for (const sym of localDefs) {
    definedIn.set(sym, file);
    if (!isGlobal.has(sym)) isGlobal.set(sym, false);
  }
  for (const sym of refs) {
    if (!allRefs.has(sym)) allRefs.set(sym, new Set());
    allRefs.get(sym)!.add(file);
  }
}

// Parse sized functions from symbol_addrs.txt so we can skip symbols that
// fall inside a sized function's range (e.g., jump table case targets that
// were merged into their parent function via size:)
const sizedFunctions: Array<{ addr: number; size: number }> = [];
{
  const symContent = readFileSync(SYMBOLS_PATH, "utf-8");
  for (const line of symContent.split("\n")) {
    const m = line.match(/=\s*0x([0-9A-Fa-f]+).*size:0x([0-9A-Fa-f]+).*type:func/);
    if (m) {
      sizedFunctions.push({
        addr: parseInt(m[1], 16),
        size: parseInt(m[2], 16),
      });
    }
  }
}

function isInsideSizedFunction(vram: number): boolean {
  for (const fn of sizedFunctions) {
    if (vram > fn.addr && vram < fn.addr + fn.size) {
      return true;
    }
  }
  return false;
}

// Find cross-file references to non-global labels
const problems: { symbol: string; defFile: string; refFiles: string[] }[] = [];

for (const [sym, refFileSet] of allRefs) {
  const defFile = definedIn.get(sym);
  if (!defFile) continue; // defined elsewhere (external symbol), skip

  // Check if any reference comes from a different file
  const crossFileRefs = [...refFileSet].filter((f) => f !== defFile);
  if (crossFileRefs.length === 0) continue;

  // If it's already global, no problem
  if (isGlobal.get(sym)) continue;

  // Skip symbols that fall inside a sized function's range — these are
  // internal labels (e.g., jump table case targets) that will be emitted
  // with jlabel by spimdisasm once the parent function's size is correct
  const addrMatch = sym.match(/([0-9A-Fa-f]{8})/);
  if (addrMatch && isInsideSizedFunction(parseInt(addrMatch[1], 16))) {
    continue;
  }

  problems.push({ symbol: sym, defFile, refFiles: crossFileRefs });
}

if (problems.length === 0) {
  console.log("No cross-file reference issues found.");
  process.exit(0);
}

console.log(`\nFound ${problems.length} cross-file reference(s):\n`);

// Parse existing symbol_addrs.txt
const existingSymbols = new Set<string>();
const symbolLines = readFileSync(SYMBOLS_PATH, "utf-8").split("\n");
for (const line of symbolLines) {
  const match = line.match(/^(\S+)\s*=/);
  if (match) existingSymbols.add(match[1]);
}

// Generate fixes
const newEntries: string[] = [];

for (const { symbol, defFile, refFiles } of problems) {
  // Extract vram address from symbol name
  const addrMatch = symbol.match(/([0-9A-Fa-f]{8})/);
  if (!addrMatch) {
    console.log(`  SKIP: ${symbol} — can't extract address`);
    continue;
  }

  const vram = parseInt(addrMatch[1], 16);
  const name = symbol.startsWith(".L")
    ? `func_${addrMatch[1].toUpperCase()}`
    : symbol;

  console.log(
    `  ${symbol} (0x${vram.toString(16).toUpperCase()})` +
      `  defined in ${defFile.split("/").pop()}` +
      `  referenced from ${refFiles.map((f) => f.split("/").pop()).join(", ")}`
  );

  if (existingSymbols.has(name)) {
    // Already in symbol_addrs.txt — needs type:func added
    console.log(`    → exists in symbol_addrs.txt, needs type:func`);
  } else {
    // New entry needed
    console.log(`    → adding to symbol_addrs.txt with type:func`);
  }

  newEntries.push({ name, vram } as any);
}

const writeMode = process.argv.includes("--write");

if (!writeMode) {
  console.log(`\nDry run. Run with --write to update symbol_addrs.txt`);
  process.exit(0);
}

// Update symbol_addrs.txt
let content = readFileSync(SYMBOLS_PATH, "utf-8");

for (const entry of newEntries as any[]) {
  const { name, vram } = entry;
  const addrHex = `0x${vram.toString(16).toUpperCase()}`;
  const typeSuffix = `// type:func`;

  if (existingSymbols.has(name)) {
    // Update existing entry to add type:func if not already present
    const lineRe = new RegExp(`^(${name}\\s*=\\s*${addrHex};)(.*)$`, "m");
    const match = content.match(lineRe);
    if (match && !match[2].includes("type:func")) {
      const existing = match[0].trimEnd();
      if (existing.includes("//")) {
        // Append type:func to existing attributes
        content = content.replace(existing, `${existing} type:func`);
      } else {
        content = content.replace(existing, `${existing} // type:func`);
      }
    }
  } else {
    // Insert new entry in sorted position
    const newLine = `${name} = ${addrHex}; // type:func`;
    const lines = content.split("\n");
    let inserted = false;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/=\s*0x([0-9A-Fa-f]+)/);
      if (m && parseInt(m[1], 16) > vram) {
        lines.splice(i, 0, newLine);
        inserted = true;
        break;
      }
    }
    if (!inserted) lines.push(newLine);
    content = lines.join("\n");
  }
}

writeFileSync(SYMBOLS_PATH, content);
console.log(`\nUpdated ${SYMBOLS_PATH}`);

// Also add c entries to splat.yaml for new function symbols
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const PAYLOAD_OFFSET = _info.payloadOffset;

let yamlContent = readFileSync(SPLAT_YAML, "utf-8");
const yamlLines = yamlContent.split("\n");
const segRomRe = /^\s+- \[(0x[0-9A-Fa-f]+),\s*(?:c|o)/i;

// Collect existing segment ROMs
const existingRoms = new Set<number>();
for (const line of yamlLines) {
  const m = line.match(segRomRe);
  if (m) existingRoms.add(parseInt(m[1], 16));
}

// Check which entries need c segments added
const yamlInserts: { rom: number; name: string }[] = [];
for (const entry of newEntries as any[]) {
  const { name, vram } = entry;
  const rom = vram - LOAD_ADDR + PAYLOAD_OFFSET;
  if (!existingRoms.has(rom)) {
    yamlInserts.push({ rom, name });
  }
}

if (yamlInserts.length > 0) {
  // Insert c entries in sorted position
  yamlInserts.sort((a, b) => a.rom - b.rom);
  for (const ins of yamlInserts) {
    const romHex = `0x${ins.rom.toString(16).toUpperCase()}`;
    const newLine = `      - [${romHex}, c, ${ins.name}]       # text-gap`;
    // Find insertion point
    for (let i = 0; i < yamlLines.length; i++) {
      const m = yamlLines[i].match(/^\s+- \[(0x[0-9A-Fa-f]+)/);
      if (m && parseInt(m[1], 16) > ins.rom) {
        yamlLines.splice(i, 0, newLine);
        break;
      }
    }
  }

  writeFileSync(SPLAT_YAML, yamlLines.join("\n"));
  console.log(`Added ${yamlInserts.length} c entries to splat.yaml`);

  // Create source files for new entries
  const srcDir = join(ROOT, "src");
  for (const ins of yamlInserts) {
    const srcPath = join(srcDir, `${ins.name}.c`);
    if (!existsSync(srcPath)) {
      const srcContent = [
        '#include "common.h"',
        '#include "include_asm.h"',
        "",
        `INCLUDE_ASM("build/asm/nonmatchings/${ins.name}", ${ins.name});`,
        "",
      ].join("\n");
      writeFileSync(srcPath, srcContent);
    }
  }
}
