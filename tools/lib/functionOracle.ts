/**
 * functionOracle.ts — is this object's code the right bytes for this function?
 *
 * One artifact, two readings. The candidate object's `.text` is relocated to
 * the function's original addresses, the target side is the original image's
 * own bytes, and both byte streams are disassembled and symbolised the same
 * way. The rendered diff and the verdict are derived from that single
 * comparison, so they cannot disagree.
 *
 * Why not compare the compiler's object against an assembled copy of splat's
 * disassembly: those are two *pre-link* encodings that legitimately differ.
 * splat names local branch targets as symbols, so assembling its `.s` emits a
 * relocation with a placeholder instruction field where the compiler resolved
 * the branch itself, and a `%hi` whose pairing heuristic failed comes back as a
 * bare immediate with no relocation at all. Both render as differences that
 * vanish at link time. Grounding the target side in the original bytes means
 * the oracle can only be wrong if the original binary is.
 *
 * Three outcomes, never two. A relocation whose symbol has no known address
 * cannot be resolved, and the word it patches is reported as *undetermined* on
 * its own diff line rather than rendered with a guess. `undetermined` is a
 * verdict in its own right.
 *
 * Scope: the function's own instructions. It does not check that the function
 * is placed at the right address in the real link, nor that its jump table or
 * anything else in the binary is right. `make check` remains the final
 * authority for those.
 */

import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { type PsxExeInfo, ROOT, loadPsxExeInfo, vramToRom } from "./psxExeInfo.js";
import {
  type SymbolIndex,
  loadFunctionDataSubsegments,
  loadFunctionSpans,
  loadSymbolAddresses,
  loadSymbolIndex,
  resolveAddress,
  addressEncodedInName,
} from "./symbolIndex.js";

const OBJDUMP = "mips-linux-gnu-objdump";
const OBJCOPY = "mips-linux-gnu-objcopy";

/** The ISA the disassembler must use; a wrong one silently renders wrong text. */
const DISASM_ARCH = "mips:3000";

function tool(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function signExtend16(value: number): number {
  const masked = value & 0xffff;
  return masked & 0x8000 ? masked - 0x10000 : masked;
}

// --- relocation ------------------------------------------------------------

export interface Relocation {
  /** Byte offset within its section. */
  offset: number;
  type: string;
  symbol: string;
}

/** Relocation types this pipeline's cc1 + GNU `as` actually emit. */
const HANDLED_RELOCATIONS = new Set([
  "R_MIPS_26",
  "R_MIPS_HI16",
  "R_MIPS_LO16",
  "R_MIPS_GPREL16",
  "R_MIPS_PC16",
  "R_MIPS_32",
]);

/**
 * Section names, as opposed to symbol names that merely start with a dot.
 *
 * splat's local labels are `.L<address>`, so "starts with a dot" is not a test
 * for a section — treating one as a section would look up the wrong base and
 * report a confident wrong operand.
 */
const SECTION_NAMES = new Set([
  ".text", ".rodata", ".rdata", ".data", ".sdata", ".sbss", ".bss", ".lit4", ".lit8",
]);

/**
 * Under o32 REL the addend lives in the instruction field, so any addend
 * objdump prints beside the symbol is that same field read back — adding it
 * would count it twice. The name is stripped of it and the field stays
 * authoritative.
 */
export function parseRelocations(dump: string): Relocation[] {
  const relocations: Relocation[] = [];
  for (const line of dump.split("\n")) {
    const match = line.match(/^([0-9a-f]{8})\s+(R_MIPS_\S+)\s+(\S+?)(?:[-+]0x[0-9a-f]+)?\s*$/);
    if (!match) continue;
    relocations.push({ offset: parseInt(match[1], 16), type: match[2], symbol: match[3] });
  }
  return relocations;
}

/**
 * The instruction field a relocation should carry once its symbol is known.
 *
 * MIPS o32 is REL: the addend lives in the field being patched, so each type
 * reads its own addend out of `field` and writes the resolved value back into
 * the same bits. `R_MIPS_HI16` additionally needs the *low* half of the split
 * addend, which lives in its matching `R_MIPS_LO16` — that is what `lowField`
 * carries, and passing the wrong one shifts the result by one in the top half.
 */
export function relocatedField(
  type: string,
  field: number,
  symbolAddress: number,
  options: { gp?: number; lowField?: number; place?: number } = {},
): number {
  switch (type) {
    case "R_MIPS_26": {
      const addend = (field & 0x03ffffff) << 2;
      const target = (symbolAddress + addend) >>> 0;
      return ((field & 0xfc000000) | ((target >>> 2) & 0x03ffffff)) >>> 0;
    }
    case "R_MIPS_HI16": {
      const addend = ((field & 0xffff) << 16) + signExtend16(options.lowField ?? 0);
      const value = (symbolAddress + addend + 0x8000) >>> 16;
      return ((field & 0xffff0000) | (value & 0xffff)) >>> 0;
    }
    case "R_MIPS_LO16":
      return ((field & 0xffff0000) | ((symbolAddress + signExtend16(field)) & 0xffff)) >>> 0;
    case "R_MIPS_GPREL16": {
      if (options.gp === undefined) throw new Error("R_MIPS_GPREL16 needs a $gp value");
      const value = symbolAddress + signExtend16(field) - options.gp;
      return ((field & 0xffff0000) | (value & 0xffff)) >>> 0;
    }
    case "R_MIPS_PC16": {
      /* The field counts instructions, not bytes, on both sides: the addend is
       * the encoded displacement scaled up, and the result is scaled back. */
      if (options.place === undefined) throw new Error("R_MIPS_PC16 needs the address it patches");
      const addend = signExtend16(field) << 2;
      const value = (symbolAddress + addend - options.place) >> 2;
      return ((field & 0xffff0000) | (value & 0xffff)) >>> 0;
    }
    case "R_MIPS_32":
      return (symbolAddress + field) >>> 0;
    default:
      throw new Error(`unhandled relocation type ${type}`);
  }
}

/**
 * The `R_MIPS_LO16` that carries a `R_MIPS_HI16`'s low addend half.
 *
 * The o32 ABI pairs a HI16 with the next LO16 against the same symbol in
 * relocation-table order — not in address order, which is why the table's own
 * sequence is the input here.
 */
export function findMatchingLow(relocations: Relocation[], hiIndex: number): Relocation | null {
  const hi = relocations[hiIndex];
  for (let index = hiIndex + 1; index < relocations.length; index++) {
    const candidate = relocations[index];
    if (candidate.type === "R_MIPS_LO16" && candidate.symbol === hi.symbol) return candidate;
  }
  return null;
}

// --- object inspection -----------------------------------------------------

export interface ObjectSymbol {
  offset: number;
  section: string;
  size: number;
  name: string;
}

export function parseSymbolTable(dump: string): ObjectSymbol[] {
  const symbols: ObjectSymbol[] = [];
  for (const line of dump.split("\n")) {
    const [left, right] = line.split("\t");
    if (right === undefined) continue;
    const leftTokens = left.trim().split(/\s+/);
    const rightTokens = right.trim().split(/\s+/);
    if (leftTokens.length < 2 || rightTokens.length < 2) continue;
    if (!/^[0-9a-f]+$/.test(leftTokens[0]) || !/^[0-9a-f]+$/.test(rightTokens[0])) continue;
    symbols.push({
      offset: parseInt(leftTokens[0], 16),
      section: leftTokens[leftTokens.length - 1],
      size: parseInt(rightTokens[0], 16),
      name: rightTokens[rightTokens.length - 1],
    });
  }
  return symbols;
}

function sectionBytes(objectPath: string, section: string): Buffer {
  const directory = mkdtempSync(join(tmpdir(), "psx-oracle-"));
  const output = join(directory, "section.bin");
  try {
    tool(OBJCOPY, ["-O", "binary", `--only-section=${section}`, objectPath, output]);
    return readFileSync(output);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// --- disassembly and symbolisation -----------------------------------------

const BRANCH_MNEMONICS = new Set([
  "b", "bal", "beq", "beql", "beqz", "beqzl", "bgez", "bgezal", "bgezl", "bgtz",
  "bgtzl", "blez", "blezl", "bltz", "bltzal", "bltzl", "bne", "bnel", "bnez",
  "bnezl",
]);
const JUMP_MNEMONICS = new Set(["j", "jal"]);

export interface RenderedWord {
  vram: number;
  raw: number;
  /** What the reader sees. Never carries a guessed operand. */
  text: string;
  /** Alignment key — local targets as PC deltas so a shift does not desync. */
  key: string;
  /** Set when a relocation on this word could not be resolved. */
  undetermined?: string;
}

export interface SymbolContext {
  index: SymbolIndex;
  gp: number;
  functionName: string;
  functionStart: number;
  /** Upper bound of the function-relative window, in bytes. */
  functionExtent: number;
}

function describeAddress(context: SymbolContext, address: number): string {
  const offset = address - context.functionStart;
  if (offset >= 0 && offset < context.functionExtent) {
    return offset === 0 ? context.functionName : `${context.functionName}+0x${offset.toString(16)}`;
  }
  const resolved = resolveAddress(context.index, address);
  if (!resolved) return `0x${address.toString(16).toUpperCase()}`;
  return resolved.offset === 0 ? resolved.symbol : `${resolved.symbol}+0x${resolved.offset.toString(16)}`;
}

function describeGpTarget(context: SymbolContext, displacement: number): string | null {
  const resolved = resolveAddress(context.index, (context.gp + displacement) >>> 0);
  if (!resolved) return null;
  return resolved.offset === 0 ? resolved.symbol : `${resolved.symbol}+0x${resolved.offset.toString(16)}`;
}

/**
 * Rendered text and alignment key for one disassembled word.
 *
 * Display keeps local targets function-relative, which is stable across runs
 * and reads directly. The alignment key uses a PC delta instead, so that an
 * inserted or removed instruction shifts addresses without desynchronising
 * every later line — the key only decides how lines pair up, never whether
 * they match, so making it shift-tolerant costs no accuracy.
 */
export function symboliseWord(
  context: SymbolContext,
  vram: number,
  mnemonic: string,
  operands: string,
): { text: string; key: string } {
  let text = operands;
  let key = operands;

  if (BRANCH_MNEMONICS.has(mnemonic) || JUMP_MNEMONICS.has(mnemonic)) {
    const match = operands.match(/^(.*?)(?:0x)?([0-9a-f]+)$/);
    if (match) {
      const target = parseInt(match[2], 16);
      text = `${match[1]}${describeAddress(context, target)}`;
      const delta = target - vram;
      key = `${match[1]}pc${delta >= 0 ? "+" : "-"}0x${Math.abs(delta).toString(16)}`;
    }
  } else {
    const based = operands.match(/^(.*?)(-?\d+)\(gp\)$/);
    const materialised = operands.match(/^(.*?),gp,(-?\d+)$/);
    if (based) {
      const symbol = describeGpTarget(context, Number(based[2]));
      if (symbol) text = key = `${based[1]}%gp_rel(${symbol})(gp)`;
    } else if (materialised) {
      const symbol = describeGpTarget(context, Number(materialised[2]));
      if (symbol) text = key = `${materialised[1]},gp,%gp_rel(${symbol})`;
    }
  }

  return {
    text: `${mnemonic.padEnd(8)}${text}`.trimEnd(),
    key: `${mnemonic} ${key}`.trimEnd(),
  };
}

/**
 * Disassemble a raw byte stream at a fixed base address.
 *
 * Both sides go through this, so identical bytes necessarily produce identical
 * text. Words objdump declines to decode still occupy their slot: the array is
 * indexed by address, so a gap can never shift the words after it.
 */
export function disassembleBytes(bytes: Buffer, baseVram: number): string[] {
  const directory = mkdtempSync(join(tmpdir(), "psx-oracle-"));
  const binary = join(directory, "code.bin");
  try {
    writeFileSync(binary, bytes);
    const dump = tool(OBJDUMP, [
      "-D", "-b", "binary", "-m", DISASM_ARCH, "-EL", "-z", "--no-show-raw-insn",
      `--adjust-vma=0x${baseVram.toString(16)}`, binary,
    ]);
    const lines: string[] = new Array(Math.floor(bytes.length / 4)).fill("");
    for (const line of dump.split("\n")) {
      const match = line.match(/^\s*([0-9a-f]+):\s+(.*?)\s*$/);
      if (!match) continue;
      const index = (parseInt(match[1], 16) - baseVram) / 4;
      if (!Number.isInteger(index) || index < 0 || index >= lines.length) continue;
      lines[index] = match[2].replace(/\s+<[^>]*>$/, "").replace(/\s+/g, " ");
    }
    return lines.map((line, index) =>
      line || `.word 0x${bytes.readUInt32LE(index * 4).toString(16).padStart(8, "0")}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function renderWords(
  context: SymbolContext,
  bytes: Buffer,
  baseVram: number,
  undetermined: Map<number, string> = new Map(),
): RenderedWord[] {
  const disassembly = disassembleBytes(bytes, baseVram);
  return disassembly.map((line, index) => {
    const [mnemonic, operands = ""] = line.split(/\s+(.*)/);
    const vram = baseVram + index * 4;
    const rendered = symboliseWord(context, vram, mnemonic, operands);
    const reason = undetermined.get(index * 4);
    const word: RenderedWord = {
      vram,
      raw: bytes.readUInt32LE(index * 4),
      text: reason ? `${mnemonic.padEnd(8)}<undetermined>` : rendered.text,
      key: reason ? `${mnemonic} <undetermined>` : rendered.key,
    };
    if (reason) word.undetermined = reason;
    return word;
  });
}

// --- alignment and verdict -------------------------------------------------

function lcsPairs(left: string[], right: string[]): Array<[number, number]> {
  const table: Uint32Array[] = Array.from(
    { length: left.length + 1 },
    () => new Uint32Array(right.length + 1),
  );
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) pairs.push([i++, j++]);
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export type RowKind = "same" | "target-only" | "candidate-only" | "undetermined";

export interface DiffRow {
  kind: RowKind;
  target?: RenderedWord;
  candidate?: RenderedWord;
}

export type Verdict = "match" | "mismatch" | "undetermined";

export interface OracleComparison {
  rows: DiffRow[];
  /** Words proven identical. */
  same: number;
  /** VRAM of every word proven different. */
  differing: number[];
  undetermined: RenderedWord[];
  verdict: Verdict;
}

/**
 * Pair the two streams and decide the verdict from the result.
 *
 * Alignment is by rendered key, but a pair only counts as the same word when
 * its *raw* encodings are equal — two encodings can render alike (`or rd,rs,$0`
 * and `addu rd,rs,$0` are both `move`), and the verdict is a claim about
 * bytes. So the displayed diff is empty exactly when every word matched, which
 * is what makes "the diff came out empty" a sound verdict rather than a second
 * opinion.
 */
export function compareWords(target: RenderedWord[], candidate: RenderedWord[]): OracleComparison {
  const pairs = lcsPairs(target.map((word) => word.key), candidate.map((word) => word.key));
  const rows: DiffRow[] = [];
  const differing: number[] = [];
  const undetermined: RenderedWord[] = [];
  let same = 0;
  let structural = false;

  let ti = 0;
  let ci = 0;

  const settle = (targetWord: RenderedWord, candidateWord: RenderedWord) => {
    if (candidateWord.undetermined) {
      rows.push({ kind: "undetermined", target: targetWord, candidate: candidateWord });
      undetermined.push(candidateWord);
      return;
    }
    if (targetWord.raw === candidateWord.raw) {
      rows.push({ kind: "same", target: targetWord, candidate: candidateWord });
      same++;
      return;
    }
    rows.push({ kind: "target-only", target: targetWord });
    rows.push({ kind: "candidate-only", candidate: candidateWord });
    differing.push(targetWord.vram);
  };

  /* Words the alignment left unpaired still sit opposite each other until one
   * side runs out; comparing that overlap word by word keeps a plain wrong
   * operand out of the insertion/deletion bucket, where it would read as a
   * structural change it is not. */
  const flushTo = (pt: number, pc: number) => {
    while (ti < pt && ci < pc) settle(target[ti++], candidate[ci++]);
    while (ti < pt) {
      rows.push({ kind: "target-only", target: target[ti++] });
      structural = true;
    }
    while (ci < pc) {
      const word = candidate[ci++];
      rows.push({ kind: "candidate-only", candidate: word });
      if (word.undetermined) undetermined.push(word);
      structural = true;
    }
  };

  for (const [pt, pc] of pairs) {
    flushTo(pt, pc);
    settle(target[ti++], candidate[ci++]);
  }
  flushTo(target.length, candidate.length);

  const verdict: Verdict = differing.length > 0 || structural
    ? "mismatch"
    : undetermined.length > 0 ? "undetermined" : "match";

  return { rows, same, differing, undetermined, verdict };
}

// --- the oracle ------------------------------------------------------------

export interface OracleResult extends OracleComparison {
  functionName: string;
  vram: number;
  objectPath: string;
  targetWords: RenderedWord[];
  candidateWords: RenderedWord[];
  /** Conditions the reader has to know about; never a substitute for a row. */
  notes: string[];
}

export interface OracleOptions {
  /** Defaults to `build/src/<name>.c.o`. */
  objectPath?: string;
  info?: PsxExeInfo;
  index?: SymbolIndex;
}

/**
 * Section addresses in the original image, for the sections this object's
 * `.text` relocations can name.
 *
 * `.text` follows from where the function symbol sits inside it. A data
 * section splat has assigned to this function has a known address, which is
 * the only sound source for a compiled jump table's base. Anything else is
 * left unknown, and the words that reference it come out undetermined.
 */
function resolveSectionBases(functionName: string, textBase: number): Map<string, number> {
  const bases = new Map<string, number>([[".text", textBase]]);
  for (const [section, vram] of loadFunctionDataSubsegments(functionName)) bases.set(section, vram);
  /* cc1 emits `.rdata`; splat names the same subsegment `.rodata`. */
  if (bases.has(".rodata") && !bases.has(".rdata")) bases.set(".rdata", bases.get(".rodata")!);
  if (bases.has(".rdata") && !bases.has(".rodata")) bases.set(".rodata", bases.get(".rdata")!);
  return bases;
}

/**
 * The object's `.text` symbol that implements a splat subsegment.
 *
 * The subsegment's name is the file's, and the two need not agree: an
 * `INCLUDE_ASM` stub named for its source file still defines the symbol the
 * disassembly named. Matching the address is what settles it — the name is
 * only the first guess.
 */
export function locateFunctionSymbol(
  symbols: ObjectSymbol[],
  functionName: string,
  vram: number,
  symbolAddresses: Map<string, number>,
): ObjectSymbol | null {
  const textSymbols = symbols.filter((symbol) => symbol.section === ".text");
  const named = textSymbols.find((symbol) => symbol.name === functionName);
  if (named) return named;
  return textSymbols.find((symbol) => {
    const address = symbolAddresses.get(symbol.name) ?? addressEncodedInName(symbol.name);
    return address === vram && symbol.size > 0;
  }) ?? null;
}

export function compareFunction(functionName: string, options: OracleOptions = {}): OracleResult {
  const info = options.info ?? loadPsxExeInfo();
  const index = options.index ?? loadSymbolIndex();
  const objectPath = options.objectPath ?? join(ROOT, "build/src", `${functionName}.c.o`);
  const notes: string[] = [];

  const span = loadFunctionSpans().find((entry) => entry.name === functionName);
  if (!span) throw new Error(`${functionName} has no subsegment in configs/splat.yaml`);
  if (!existsSync(objectPath)) throw new Error(`Object not found: ${objectPath}`);

  const symbolAddresses = loadSymbolAddresses();
  /* `--special-syms`: objdump hides `.L`-prefixed symbols by default, and
   * splat's local labels are exactly those — a relocation against one is
   * unresolvable without them. */
  const symbols = parseSymbolTable(tool(OBJDUMP, ["-t", "--special-syms", objectPath]));
  const functionSymbol = locateFunctionSymbol(symbols, functionName, span.vram, symbolAddresses);
  if (!functionSymbol) {
    throw new Error(`${objectPath} defines no .text symbol for ${functionName} (0x${span.vram.toString(16)})`);
  }

  const textBase = span.vram - functionSymbol.offset;
  const sectionBases = resolveSectionBases(functionName, textBase);
  const definedInObject = new Map(symbols.map((symbol) => [symbol.name, symbol]));

  /**
   * A relocation's symbol, as an original address.
   *
   * Order matters. A section symbol carries no name to look up. The project's
   * symbol tables are authoritative for anything they cover. A symbol this
   * object defines itself — a splat local label, a static helper — is placed by
   * its own section, which is the only witness for a name no table lists.
   * splat's address-encoding naming is the last resort, and an unresolved
   * symbol resolves to nothing at all rather than to a guess.
   */
  const resolveRelocationSymbol = (name: string): number | undefined => {
    if (SECTION_NAMES.has(name)) return sectionBases.get(name);
    const tabled = symbolAddresses.get(name);
    if (tabled !== undefined) return tabled;
    const local = definedInObject.get(name);
    const base = local ? sectionBases.get(local.section) : undefined;
    if (base !== undefined && local) return base + local.offset;
    return addressEncodedInName(name) ?? undefined;
  };

  const text = sectionBytes(objectPath, ".text");
  const relocations = parseRelocations(tool(OBJDUMP, ["-r", "--section=.text", objectPath]));
  const undetermined = new Map<number, string>();

  for (let position = 0; position < relocations.length; position++) {
    const relocation = relocations[position];
    if (relocation.offset + 4 > text.length) continue;

    if (!HANDLED_RELOCATIONS.has(relocation.type)) {
      undetermined.set(relocation.offset, `${relocation.type} is not resolved by this tool`);
      continue;
    }

    const address = resolveRelocationSymbol(relocation.symbol);
    if (address === undefined) {
      undetermined.set(
        relocation.offset,
        SECTION_NAMES.has(relocation.symbol)
          ? `${relocation.type} against section ${relocation.symbol}: no original address for it`
          : `${relocation.type} against ${relocation.symbol}: no address in the symbol tables`,
      );
      continue;
    }

    const field = text.readUInt32LE(relocation.offset);
    const lowField = relocation.type === "R_MIPS_HI16"
      ? findMatchingLow(relocations, position)
      : null;
    if (relocation.type === "R_MIPS_HI16" && !lowField) {
      undetermined.set(relocation.offset, `R_MIPS_HI16 against ${relocation.symbol} has no matching R_MIPS_LO16`);
      continue;
    }
    text.writeUInt32LE(
      relocatedField(relocation.type, field, address, {
        gp: info.gpValue,
        lowField: lowField ? text.readUInt32LE(lowField.offset) : 0,
        place: textBase + relocation.offset,
      }),
      relocation.offset,
    );
  }

  const candidateSize = functionSymbol.size > 0
    ? functionSymbol.size
    : text.length - functionSymbol.offset;
  const candidateBytes = text.subarray(functionSymbol.offset, functionSymbol.offset + candidateSize);
  const candidateUndetermined = new Map<number, string>();
  for (const [offset, reason] of undetermined) {
    if (offset >= functionSymbol.offset && offset < functionSymbol.offset + candidateSize) {
      candidateUndetermined.set(offset - functionSymbol.offset, reason);
    }
  }

  const image = readFileSync(info.binaryPath);
  const rom = vramToRom(span.vram, info);
  const targetBytes = image.subarray(rom, rom + span.size);

  const context: SymbolContext = {
    index,
    gp: info.gpValue,
    functionName,
    functionStart: span.vram,
    functionExtent: Math.max(span.size, candidateSize),
  };

  const targetWords = renderWords(context, targetBytes, span.vram);
  const candidateWords = renderWords(context, candidateBytes, span.vram, candidateUndetermined);
  const comparison = compareWords(targetWords, candidateWords);

  if (targetWords.length !== candidateWords.length) {
    notes.push(
      "The instruction counts differ. Scheduling never changes a count, and allocation",
      "  changes it in exactly one way: when both ends of a register-to-register copy get",
      "  the same register, the copy becomes a no-op move and jump_optimize deletes it. So",
      "  a delta of one move is an allocation question, not a semantics one — run",
      "  psx_reverse_pipeline, which separates the two, before rewriting the source.",
      "  Local targets are shown relative to the function, so while the counts differ every",
      "  branch and jump past the first structural difference resolves elsewhere and lights",
      "  up. Those realign on their own once the counts match.",
    );
  }
  if (!sectionBases.has(".rodata") && relocations.some((relocation) => relocation.symbol === ".rodata")) {
    notes.push(
      "This object emits a .rodata block (a jump table) and configs/splat.yaml has no",
      `  '.rodata, ${functionName}' subsegment, so its original base address is unknown and`,
      "  every word that reaches it is undetermined. Run `make split` to generate the",
      "  subsegment — do not edit splat.yaml by hand, it is regenerated.",
    );
  }

  return {
    ...comparison,
    functionName,
    vram: span.vram,
    objectPath,
    targetWords,
    candidateWords,
    notes,
  };
}

// --- rendering -------------------------------------------------------------

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function address(word: RenderedWord): string {
  return word.vram.toString(16).toUpperCase();
}

export function renderDiff(result: OracleResult, colour = true): string[] {
  const paint = (code: string, text: string) => (colour ? `${code}${text}${RESET}` : text);
  const lines: string[] = [];
  for (const row of result.rows) {
    if (row.kind === "same") {
      lines.push(paint(DIM, ` ${address(row.target!)}: ${row.target!.text}`));
    } else if (row.kind === "target-only") {
      lines.push(paint(RED, `-${address(row.target!)}: ${row.target!.text}`));
    } else if (row.kind === "candidate-only") {
      lines.push(paint(GREEN, `+${address(row.candidate!)}: ${row.candidate!.text}`));
    } else {
      lines.push(paint(RED, `-${address(row.target!)}: ${row.target!.text}`));
      lines.push(paint(YELLOW, `?${address(row.candidate!)}: ${row.candidate!.text}  <- ${row.candidate!.undetermined}`));
    }
  }
  return lines;
}

export function renderVerdict(result: OracleResult): string[] {
  const total = Math.max(result.targetWords.length, result.candidateWords.length);
  const percent = total > 0 ? ((result.same / total) * 100).toFixed(1) : "0.0";
  const lines = [`Match: ${result.same}/${total} words (${percent}%)`];

  if (result.targetWords.length !== result.candidateWords.length) {
    lines.push(`  target: ${result.targetWords.length} instrs, candidate: ${result.candidateWords.length} instrs`);
  }

  if (result.verdict === "match") {
    lines.push("VERDICT: MATCH — every word is byte-identical to the original after relocation.");
  } else if (result.verdict === "undetermined") {
    lines.push(
      `VERDICT: UNDETERMINED — ${result.undetermined.length} word(s) could not be resolved; ` +
      "nothing else differs. This is neither a match nor a mismatch.",
    );
  } else {
    const detail = result.undetermined.length > 0
      ? `, ${result.undetermined.length} undetermined`
      : "";
    lines.push(`VERDICT: MISMATCH — ${result.differing.length} word(s) differ${detail}.`);
  }

  if (result.differing.length > 0) {
    const shown = result.differing.slice(0, 24).map((vram) => `0x${vram.toString(16).toUpperCase()}`);
    const tail = result.differing.length > shown.length ? ` (+${result.differing.length - shown.length} more)` : "";
    lines.push(`  differing words: ${shown.join(" ")}${tail}`);
  }
  for (const word of result.undetermined) {
    lines.push(`  undetermined 0x${address(word)}: ${word.undetermined}`);
  }
  for (const note of result.notes) lines.push(`  ${note}`);
  return lines;
}
