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

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASM_DIR = join(ROOT, "build/asm");
const SYMBOLS_PATH = join(ROOT, "configs/symbol_addrs.txt");

const LOAD_ADDR = 0x80010000;
const HEADER_SIZE = 0x800;
const TEXT_START = 0x80011270;
const TEXT_END = 0x80048190;

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

// Scan all .s files
const files = readdirSync(ASM_DIR)
  .filter((f) => f.endsWith(".s"))
  .map((f) => join(ASM_DIR, f));

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
