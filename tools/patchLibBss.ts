/**
 * patchLibBss.ts — Patch library .o files to resolve BSS symbols to absolute addresses
 *
 * The original PSX linker (PSYLINK) allocated each BSS symbol independently at
 * arbitrary addresses, while GNU ld places the entire .bss section as a contiguous
 * block. This tool resolves BSS symbols to their correct absolute addresses by:
 *
 * 1. Converting all BSS symbols to SHN_ABS with their correct absolute addresses
 * 2. Setting the .bss section size to 0 (so no space is allocated by the linker)
 *
 * For global BSS symbols: addresses come from build/lib_bss_syms.txt
 * For local BSS symbols: addresses are computed from the original binary using
 *   HI16/LO16 relocation pairs
 *
 * Patched files are written to build/lib/ (same directory structure as lib/).
 * The linker script is updated to reference build/lib/ instead of lib/.
 *
 * Usage:
 *   npx tsx tools/patchLibBss.ts           # dry run
 *   npx tsx tools/patchLibBss.ts --write   # patch files and update linker script
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BINARY_PATH = join(ROOT, "extracted/iso/slus_011.15");
const LD_SCRIPT = join(ROOT, "slus_011.ld");
const CACHE_PATH = join(ROOT, "build/libSections.json");
const BSS_SYMS_PATH = join(ROOT, "build/lib_bss_syms.txt");
const BUILD_LIB = join(ROOT, "build/lib");

// ELF constants
const SHN_ABS = 0xfff1;
const SHT_NOBITS = 8;
const SHT_SYMTAB = 2;
const SHT_REL = 9;

// Relocation types
const R_MIPS_HI16 = 5;
const R_MIPS_LO16 = 6;

interface LibSections {
  oPath: string;
  textRom: number;
  textSize: number;
  dataRom?: number;
  dataSize?: number;
  rdataRom?: number;
  rdataSize?: number;
  bssVram?: number;
  bssSize?: number;
}

interface ElfSectionHeader {
  index: number;
  sh_name: number;
  sh_type: number;
  sh_flags: number;
  sh_addr: number;
  sh_offset: number;
  sh_size: number;
  sh_link: number;
  sh_info: number;
  sh_addralign: number;
  sh_entsize: number;
  // Derived
  nameStr: string;
}

interface ElfSymbol {
  index: number;
  st_name: number;
  st_value: number;
  st_size: number;
  st_info: number;
  st_other: number;
  st_shndx: number;
  // Derived
  nameStr: string;
  binding: number;
  type: number;
  fileOffset: number; // offset of this symbol entry in the file
}

interface ElfReloc {
  index: number;
  r_offset: number;
  r_info: number;
  // Derived
  symIndex: number;
  type: number;
  fileOffset: number; // offset of this reloc entry in the file
}

/** Parse ELF header from a buffer */
function parseElfHeader(buf: Buffer) {
  // Verify magic
  if (buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) {
    throw new Error("Not an ELF file");
  }
  if (buf[4] !== 1) throw new Error("Not 32-bit ELF");
  if (buf[5] !== 1) throw new Error("Not little-endian ELF");

  return {
    e_shoff: buf.readUInt32LE(0x20),
    e_shentsize: buf.readUInt16LE(0x2e),
    e_shnum: buf.readUInt16LE(0x30),
    e_shstrndx: buf.readUInt16LE(0x32),
  };
}

/** Read a null-terminated string from a buffer */
function readString(buf: Buffer, offset: number): string {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  return buf.toString("utf-8", offset, end);
}

/** Parse section headers */
function parseSectionHeaders(buf: Buffer): ElfSectionHeader[] {
  const hdr = parseElfHeader(buf);
  const sections: ElfSectionHeader[] = [];

  // First pass: read raw section headers
  for (let i = 0; i < hdr.e_shnum; i++) {
    const off = hdr.e_shoff + i * hdr.e_shentsize;
    sections.push({
      index: i,
      sh_name: buf.readUInt32LE(off + 0),
      sh_type: buf.readUInt32LE(off + 4),
      sh_flags: buf.readUInt32LE(off + 8),
      sh_addr: buf.readUInt32LE(off + 12),
      sh_offset: buf.readUInt32LE(off + 16),
      sh_size: buf.readUInt32LE(off + 20),
      sh_link: buf.readUInt32LE(off + 24),
      sh_info: buf.readUInt32LE(off + 28),
      sh_addralign: buf.readUInt32LE(off + 32),
      sh_entsize: buf.readUInt32LE(off + 36),
      nameStr: "",
    });
  }

  // Second pass: resolve names from shstrtab
  const shstrtab = sections[hdr.e_shstrndx];
  for (const sec of sections) {
    sec.nameStr = readString(buf, shstrtab.sh_offset + sec.sh_name);
  }

  return sections;
}

/** Parse symbol table */
function parseSymbolTable(
  buf: Buffer,
  symtabSection: ElfSectionHeader,
  strtabSection: ElfSectionHeader
): ElfSymbol[] {
  const symbols: ElfSymbol[] = [];
  const count = symtabSection.sh_size / 16; // Elf32_Sym is 16 bytes

  for (let i = 0; i < count; i++) {
    const off = symtabSection.sh_offset + i * 16;
    const st_info = buf.readUInt8(off + 12);
    symbols.push({
      index: i,
      st_name: buf.readUInt32LE(off + 0),
      st_value: buf.readUInt32LE(off + 4),
      st_size: buf.readUInt32LE(off + 8),
      st_info,
      st_other: buf.readUInt8(off + 13),
      st_shndx: buf.readUInt16LE(off + 14),
      nameStr: readString(buf, strtabSection.sh_offset + buf.readUInt32LE(off + 0)),
      binding: st_info >> 4,
      type: st_info & 0xf,
      fileOffset: off,
    });
  }

  return symbols;
}

/** Parse relocation table */
function parseRelocs(buf: Buffer, relSection: ElfSectionHeader): ElfReloc[] {
  const relocs: ElfReloc[] = [];
  const count = relSection.sh_size / 8; // Elf32_Rel is 8 bytes

  for (let i = 0; i < count; i++) {
    const off = relSection.sh_offset + i * 8;
    const r_info = buf.readUInt32LE(off + 4);
    relocs.push({
      index: i,
      r_offset: buf.readUInt32LE(off + 0),
      r_info,
      symIndex: r_info >> 8,
      type: r_info & 0xff,
      fileOffset: off,
    });
  }

  return relocs;
}

/** Sign-extend a 16-bit value */
function signExtend16(value: number): number {
  if (value & 0x8000) return value - 0x10000;
  return value;
}

/** Read a 32-bit LE word */
function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

/** Extract 16-bit immediate from MIPS instruction */
function extractImm16(instruction: number): number {
  return instruction & 0xffff;
}

/**
 * Resolve a HI16/LO16 pair from the original binary to get the target address.
 */
function resolveHiLoPair(
  binary: Buffer,
  textFileOffset: number,
  hiRelocOffset: number,
  loRelocOffset: number
): number | null {
  const hiFileOff = textFileOffset + hiRelocOffset;
  const loFileOff = textFileOffset + loRelocOffset;
  if (hiFileOff + 4 > binary.length || loFileOff + 4 > binary.length) return null;
  if (hiFileOff < 0 || loFileOff < 0) return null;

  const hiInstr = readU32(binary, hiFileOff);
  const loInstr = readU32(binary, loFileOff);
  const hiImm = extractImm16(hiInstr);
  const loImm = signExtend16(extractImm16(loInstr));
  return ((hiImm << 16) + loImm) >>> 0;
}

/** Parse lib_bss_syms.txt into a map of symbolName -> address */
function parseGlobalBssSyms(path: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!existsSync(path)) return map;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^(\S+)\s*=\s*0x([0-9A-Fa-f]+)\s*;/);
    if (m) {
      map.set(m[1], parseInt(m[2], 16));
    }
  }
  return map;
}

/**
 * For a given .o file with BSS, resolve ALL local BSS symbol addresses
 * by reading HI16/LO16 pairs from the original binary.
 *
 * Returns a map of sectionRelativeOffset -> absoluteAddress
 */
function resolveLocalBssAddresses(
  elfBuf: Buffer,
  binary: Buffer,
  textRom: number,
  bssSectionIndex: number,
  symbols: ElfSymbol[],
  sections: ElfSectionHeader[]
): Map<number, number> {
  const offsetToAddr = new Map<number, number>();

  // Find .rel.text section
  const relTextSection = sections.find(
    (s) => s.nameStr === ".rel.text" && s.sh_type === SHT_REL
  );
  if (!relTextSection) return offsetToAddr;

  const relocs = parseRelocs(elfBuf, relTextSection);

  // Build symbol index map
  const symMap = new Map<number, ElfSymbol>();
  for (const sym of symbols) symMap.set(sym.index, sym);

  // Find all HI16 relocs targeting BSS symbols
  for (let i = 0; i < relocs.length; i++) {
    const reloc = relocs[i];
    if (reloc.type !== R_MIPS_HI16) continue;

    const sym = symMap.get(reloc.symIndex);
    if (!sym || sym.st_shndx !== bssSectionIndex) continue;

    // Find paired LO16 for same symbol
    let lo16: ElfReloc | null = null;
    for (let j = i + 1; j < relocs.length; j++) {
      if (relocs[j].type === R_MIPS_LO16 && relocs[j].symIndex === reloc.symIndex) {
        lo16 = relocs[j];
        break;
      }
    }
    if (!lo16) continue;

    const resolvedAddr = resolveHiLoPair(binary, textRom, reloc.r_offset, lo16.r_offset);
    if (resolvedAddr === null) continue;

    // The symbol's st_value is the section-relative offset
    // resolvedAddr = absolute address of (bssBase + sym.value + addend_in_instruction)
    // For named symbols, the instruction addend should be 0 (the sym.value already includes the offset)
    // Actually, the resolved addr from the binary is the FINAL address for what this relocation targets.
    // The relocation formula: target = sym_section_base + sym_value + addend_from_instruction
    // In the original binary, the instruction has the fully-resolved address.
    // sym.value IS the offset into .bss for this symbol.
    // So: resolved_addr is the absolute address that sym.value maps to.
    // We just record: sym.value -> resolvedAddr
    if (resolvedAddr >= 0x80000000 && resolvedAddr < 0x80800000) {
      offsetToAddr.set(sym.st_value, resolvedAddr);
    }
  }

  return offsetToAddr;
}

/**
 * Patch a single .o file:
 * 1. Convert all BSS symbols to SHN_ABS with correct absolute addresses
 * 2. Set .bss section size to 0 and clear alloc flag
 */
function patchOFile(
  elfBuf: Buffer,
  binary: Buffer,
  entry: LibSections,
  globalBssSyms: Map<string, number>,
  verbose: boolean
): { patched: boolean; patchCount: number; errors: string[] } {
  const errors: string[] = [];
  let patchCount = 0;

  const sections = parseSectionHeaders(elfBuf);

  // Find key sections
  const bssSection = sections.find((s) => s.nameStr === ".bss" && s.sh_type === SHT_NOBITS);
  if (!bssSection) return { patched: false, patchCount: 0, errors: ["No .bss section found"] };

  const symtabSection = sections.find((s) => s.sh_type === SHT_SYMTAB);
  if (!symtabSection) return { patched: false, patchCount: 0, errors: ["No .symtab section found"] };

  // Find strtab (linked from symtab)
  const strtabSection = sections[symtabSection.sh_link];
  if (!strtabSection) return { patched: false, patchCount: 0, errors: ["No .strtab section found"] };

  const symbols = parseSymbolTable(elfBuf, symtabSection, strtabSection);
  const bssSectionIndex = bssSection.index;

  // Step 1: Resolve local BSS addresses from original binary
  let localBssAddrs = new Map<number, number>();
  if (entry.textRom > 0 && entry.textSize > 0) {
    localBssAddrs = resolveLocalBssAddresses(
      elfBuf,
      binary,
      entry.textRom,
      bssSectionIndex,
      symbols,
      sections
    );
  }

  // Step 2: Build complete address map for all BSS symbols
  // Key: symbol index -> absolute address
  const symAddrMap = new Map<number, number>();

  for (const sym of symbols) {
    if (sym.st_shndx !== bssSectionIndex) continue;

    // Try global BSS sym map first (by name)
    if (sym.nameStr && !sym.nameStr.startsWith("$") && globalBssSyms.has(sym.nameStr)) {
      symAddrMap.set(sym.index, globalBssSyms.get(sym.nameStr)!);
      continue;
    }

    // Try local address map (by section-relative offset = st_value)
    if (localBssAddrs.has(sym.st_value)) {
      symAddrMap.set(sym.index, localBssAddrs.get(sym.st_value)!);
      continue;
    }

    // For BSS-only files with no .text, we can compute from bssVram
    if (entry.bssVram && entry.bssVram > 0) {
      const addr = (entry.bssVram + sym.st_value) >>> 0;
      if (addr >= 0x80000000 && addr < 0x80800000) {
        symAddrMap.set(sym.index, addr);
        continue;
      }
    }

    errors.push(
      `Could not resolve BSS symbol ${sym.nameStr || `#${sym.index}`} (offset=0x${sym.st_value.toString(16)})`
    );
  }

  // Step 3: Convert BSS symbols to SHN_ABS with absolute addresses
  for (const sym of symbols) {
    if (sym.st_shndx !== bssSectionIndex) continue;

    const addr = symAddrMap.get(sym.index);
    if (addr === undefined) continue;

    // Patch st_value (4 bytes at fileOffset + 4)
    elfBuf.writeUInt32LE(addr, sym.fileOffset + 4);
    // Patch st_shndx (2 bytes at fileOffset + 14)
    elfBuf.writeUInt16LE(SHN_ABS, sym.fileOffset + 14);
    patchCount++;

    if (verbose) {
      console.error(
        `  Symbol ${sym.nameStr || `#${sym.index}`}: 0x${sym.st_value.toString(16)} -> ABS 0x${addr.toString(16).toUpperCase()}`
      );
    }
  }

  // No need to modify relocations or instruction addends. For ELF REL format:
  //   resolved = S + A, where S = sym.st_value, A = addend from instruction
  // After converting to ABS: S = absolute_addr, A = original addend (unchanged)
  // The linker computes absolute_addr + A, which is correct.

  // Step 4: Set .bss section size to 0 and clear flags
  // This prevents GNU ld from allocating space for .bss
  const hdr = parseElfHeader(elfBuf);
  const bssSectionFileOff = hdr.e_shoff + bssSection.index * hdr.e_shentsize;
  // sh_size is at offset 20 in the section header
  elfBuf.writeUInt32LE(0, bssSectionFileOff + 20);
  // Clear SHF_ALLOC flag so linker doesn't try to allocate it
  // sh_flags at offset 8
  elfBuf.writeUInt32LE(0, bssSectionFileOff + 8);

  return { patched: true, patchCount, errors };
}

// Relocation types needed for HI16 carry fix
const R_MIPS_26 = 4;

/**
 * Fix 3: Patch HI16/LO16 instruction addends to compensate for GNU ld carry bug.
 *
 * GNU ld sometimes computes R_MIPS_HI16 incorrectly when .o files have large
 * addends that cross 64KB boundaries. This function reads the original binary's
 * resolved instructions, computes what GNU ld will produce, and adjusts the .o
 * file's addends to compensate.
 */
function patchHi16Carry(
  elfBuf: Buffer,
  binary: Buffer,
  entry: LibSections,
  verbose: boolean
): number {
  if (entry.textRom <= 0 || entry.textSize <= 0) return 0;

  const sections = parseSectionHeaders(elfBuf);
  const textSection = sections.find((s) => s.nameStr === ".text");
  if (!textSection) return 0;

  const relTextSection = sections.find(
    (s) => s.nameStr === ".rel.text" && s.sh_type === SHT_REL
  );
  if (!relTextSection) return 0;

  const symtabSection = sections.find((s) => s.sh_type === SHT_SYMTAB);
  if (!symtabSection) return 0;
  const strtabSection = sections[symtabSection.sh_link];
  if (!strtabSection) return 0;

  const relocs = parseRelocs(elfBuf, relTextSection);
  const symbols = parseSymbolTable(elfBuf, symtabSection, strtabSection);

  let patchCount = 0;

  // Process each HI16 relocation
  for (let i = 0; i < relocs.length; i++) {
    const hiReloc = relocs[i];
    if (hiReloc.type !== R_MIPS_HI16) continue;

    // Find paired LO16
    let loReloc: ElfReloc | null = null;
    for (let j = i + 1; j < relocs.length; j++) {
      if (relocs[j].type === R_MIPS_LO16 && relocs[j].symIndex === hiReloc.symIndex) {
        loReloc = relocs[j];
        break;
      }
    }
    if (!loReloc) continue;

    // Read original binary's resolved instructions
    const origHiOff = entry.textRom + hiReloc.r_offset;
    const origLoOff = entry.textRom + loReloc.r_offset;
    if (origHiOff + 4 > binary.length || origLoOff + 4 > binary.length) continue;

    const origHiInstr = binary.readUInt32LE(origHiOff);
    const origLoInstr = binary.readUInt32LE(origLoOff);
    const origHiImm = origHiInstr & 0xFFFF;
    const origLoImm = origLoInstr & 0xFFFF;

    // Read .o file's unresolved instructions (addends)
    const oHiOff = textSection.sh_offset + hiReloc.r_offset;
    const oLoOff = textSection.sh_offset + loReloc.r_offset;
    if (oHiOff + 4 > elfBuf.length || oLoOff + 4 > elfBuf.length) continue;

    const oHiInstr = elfBuf.readUInt32LE(oHiOff);
    const oLoInstr = elfBuf.readUInt32LE(oLoOff);
    const oHiImm = oHiInstr & 0xFFFF;
    const oLoImm = oLoInstr & 0xFFFF;

    // Get the symbol's resolved address
    const sym = symbols[hiReloc.symIndex];
    if (!sym) continue;

    // Compute the addend: AHL = (oHiImm << 16) + signExtend(oLoImm)
    const oLoSigned = signExtend16(oLoImm);
    const AHL = ((oHiImm << 16) + oLoSigned) | 0;

    // The symbol's value (after our BSS patching, it might be ABS)
    // For the carry computation, we need to know what S (symbol value) the linker will use
    // S = sym.st_value (after our patching)
    const S = elfBuf.readUInt32LE(sym.fileOffset + 4); // re-read in case it was patched

    // What GNU ld computes:
    // result = S + AHL
    // HI16 = (result >> 16) & 0xFFFF  (with carry from LO16 sign)
    // LO16 = result & 0xFFFF
    const result = (S + AHL) | 0;
    const gnuLoImm = result & 0xFFFF;
    const carry = gnuLoImm >= 0x8000 ? 1 : 0;
    const gnuHiImm = ((result >>> 16) + carry) & 0xFFFF;

    // Compare with original binary
    if (gnuHiImm !== origHiImm || gnuLoImm !== origLoImm) {
      // Need to compensate. Compute what addend would produce the correct result.
      // We want: S + AHL_new → origHiImm/origLoImm
      // The original resolved value:
      const origLoSigned = signExtend16(origLoImm);
      const origResult = ((origHiImm << 16) + origLoSigned) | 0;

      // New AHL = origResult - S
      const newAHL = (origResult - S) | 0;
      const newLoImm = newAHL & 0xFFFF;
      const newHiImm = ((newAHL - signExtend16(newLoImm)) >>> 16) & 0xFFFF;

      // Verify: GNU ld should produce the correct result with these addends
      const verify = (S + ((newHiImm << 16) + signExtend16(newLoImm))) | 0;
      const vLoImm = verify & 0xFFFF;
      const vCarry = vLoImm >= 0x8000 ? 1 : 0;
      const vHiImm = ((verify >>> 16) + vCarry) & 0xFFFF;

      if (vHiImm === origHiImm && vLoImm === origLoImm) {
        // Patch the .o file
        elfBuf.writeUInt16LE(newHiImm, oHiOff);
        elfBuf.writeUInt16LE(newLoImm, oLoOff);
        patchCount++;

        if (verbose) {
          console.error(
            `  HI16 FIX: ${entry.oPath} offset 0x${hiReloc.r_offset.toString(16)}/0x${loReloc.r_offset.toString(16)}: ` +
            `HI 0x${oHiImm.toString(16)}→0x${newHiImm.toString(16)} LO 0x${oLoImm.toString(16)}→0x${newLoImm.toString(16)}`
          );
        }
      }
    }
  }

  return patchCount;
}

/**
 * Fix 4: Patch .data section bytes that don't match the original binary.
 * Skips bytes covered by .rel.data relocations.
 */
function patchDataBytes(
  elfBuf: Buffer,
  binary: Buffer,
  entry: LibSections,
  verbose: boolean
): number {
  if (!entry.dataRom || !entry.dataSize || entry.dataSize <= 0) return 0;

  const sections = parseSectionHeaders(elfBuf);
  const dataSection = sections.find((s) => s.nameStr === ".data");
  if (!dataSection || dataSection.sh_size !== entry.dataSize) return 0;

  // Find .rel.data section to know which bytes have relocations
  const relDataSection = sections.find(
    (s) => s.nameStr === ".rel.data" && s.sh_type === SHT_REL
  );
  const relocOffsets = new Set<number>();
  if (relDataSection) {
    const relocs = parseRelocs(elfBuf, relDataSection);
    for (const r of relocs) {
      for (let b = 0; b < 4; b++) relocOffsets.add(r.r_offset + b);
    }
  }

  let patchCount = 0;
  for (let i = 0; i < entry.dataSize; i++) {
    if (relocOffsets.has(i)) continue; // skip relocated bytes

    const oOff = dataSection.sh_offset + i;
    const binOff = entry.dataRom + i;
    if (oOff >= elfBuf.length || binOff >= binary.length) continue;

    if (elfBuf[oOff] !== binary[binOff]) {
      if (verbose) {
        console.error(
          `  DATA FIX: ${entry.oPath} .data[0x${i.toString(16)}]: 0x${elfBuf[oOff].toString(16)}→0x${binary[binOff].toString(16)}`
        );
      }
      elfBuf[oOff] = binary[binOff];
      patchCount++;
    }
  }

  return patchCount;
}

function main() {
  const writeMode = process.argv.includes("--write");
  const verbose = process.argv.includes("--verbose");

  if (!existsSync(CACHE_PATH)) {
    console.error("ERROR: build/libSections.json not found. Run 'make split' first.");
    process.exit(1);
  }
  if (!existsSync(BSS_SYMS_PATH)) {
    console.error("ERROR: build/lib_bss_syms.txt not found. Run 'make split' first.");
    process.exit(1);
  }

  const libSections: LibSections[] = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  const globalBssSyms = parseGlobalBssSyms(BSS_SYMS_PATH);
  const binary = readFileSync(BINARY_PATH);

  console.error(`Loaded ${globalBssSyms.size} global BSS symbol addresses`);
  console.error(`Processing ${libSections.length} library .o files`);

  const bssEntries = libSections.filter(
    (s) => s.bssSize !== undefined && s.bssSize > 0
  );
  console.error(`Found ${bssEntries.length} .o files with BSS sections`);

  let totalPatched = 0;
  let totalSymbols = 0;
  let totalErrors = 0;

  // Process all library .o files: copy to build/lib/, patch those with BSS
  for (const entry of libSections) {
    const srcPath = join(ROOT, entry.oPath);
    const dstPath = join(ROOT, "build", entry.oPath);

    // Ensure output directory exists
    mkdirSync(dirname(dstPath), { recursive: true });

    const hasBss = entry.bssSize !== undefined && entry.bssSize > 0;

    if (!hasBss) {
      // Just copy the file
      copyFileSync(srcPath, dstPath);
      continue;
    }

    // Read and patch
    const elfBuf = readFileSync(srcPath);

    if (verbose) {
      console.error(`\nPatching ${entry.oPath} (bssSize=0x${entry.bssSize!.toString(16)})`);
    }

    const result = patchOFile(elfBuf, binary, entry, globalBssSyms, verbose);

    if (result.patched) {
      totalPatched++;
      totalSymbols += result.patchCount;
    }

    for (const err of result.errors) {
      console.error(`  WARN: ${entry.oPath}: ${err}`);
      totalErrors++;
    }

    if (writeMode) {
      writeFileSync(dstPath, elfBuf);
    } else {
      // Still copy for dry run display
      copyFileSync(srcPath, dstPath);
    }
  }

  console.error(`\nResults:`);
  console.error(`  Patched ${totalPatched} .o files, ${totalSymbols} symbols converted to ABS`);
  if (totalErrors > 0) {
    console.error(`  ${totalErrors} warnings (unresolved symbols)`);
  }

  // Update linker script: replace lib/ paths with build/lib/ for library .o files
  if (writeMode && existsSync(LD_SCRIPT)) {
    const ldContent = readFileSync(LD_SCRIPT, "utf-8");

    // Replace all lib/*.o references with build/lib/*.o
    // Be careful to only replace standalone lib/ references (not build/lib/ already)
    // Match patterns like: lib/libsnd/vm_f.o(.text); or lib/libsnd/vm_f.o(.bss);
    const libOPaths = new Set(libSections.map((s) => s.oPath));

    let newContent = ldContent;
    for (const oPath of libOPaths) {
      // Replace all occurrences of this exact path
      // Use a regex that matches the path not preceded by "build/"
      const escaped = oPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?<!build/)${escaped}`, "g");
      newContent = newContent.replace(re, `build/${oPath}`);
    }

    // Also update the .lib_bss section references
    // After patching, .bss sections are empty, but the NOLOAD section
    // still needs to reference the patched files

    writeFileSync(LD_SCRIPT, newContent);
    console.error(`Updated ${LD_SCRIPT} (lib/ -> build/lib/ paths)`);

    // Strip library-defined symbols from undefined_funcs_auto.txt and undefined_syms_auto.txt
    // These auto-generated files contain linker script assignments that override
    // the actual definitions from library .o files, causing wrong addresses.
    const allLibSyms = new Set<string>();
    for (const oPath of libOPaths) {
      const buildPath = join(ROOT, "build", oPath);
      const origPath = join(ROOT, oPath);
      const path = existsSync(buildPath) ? buildPath : origPath;
      try {
        const nmOut = execSync(`mips-linux-gnu-nm ${path}`, { encoding: "utf-8" });
        for (const line of nmOut.split("\n")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3 && "TDRBtdrb".includes(parts[1])) {
            allLibSyms.add(parts[2]);
          }
        }
      } catch {}
    }

    for (const autoFile of ["build/undefined_funcs_auto.txt", "build/undefined_syms_auto.txt"]) {
      const autoPath = join(ROOT, autoFile);
      if (!existsSync(autoPath)) continue;
      const lines = readFileSync(autoPath, "utf-8").split("\n");
      const filtered = lines.filter((l) => {
        const m = l.match(/^(\w+)\s*=/);
        return !m || !allLibSyms.has(m[1]);
      });
      const removed = lines.length - filtered.length;
      if (removed > 0) {
        writeFileSync(autoPath, filtered.join("\n"));
        console.error(`Stripped ${removed} library symbols from ${autoFile}`);
      }
    }
  }

  if (!writeMode) {
    console.error("\nDry run. Run with --write to apply patches.");
  }
}

main();
