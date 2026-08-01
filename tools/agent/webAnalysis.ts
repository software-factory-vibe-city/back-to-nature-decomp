/**
 * webAnalysis.ts — shared register def/use, web, provenance, and CFG analysis
 * over instruction streams.
 *
 * Motivated by the func_800241EC failure (2026-07-31): an agent chased a
 * "2-instruction allocation swap" for a full session when the actual defect
 * was three semantic misreads. Two mechanical checks would have broken the
 * deadlock immediately:
 *
 *  - value provenance: an operand register can match by NAME while holding a
 *    different VALUE (the target had redefined $a1 mid-function; the wrong
 *    source coincidentally also used $a1 there);
 *  - web parity: a register-allocation-only mismatch preserves the pseudo web
 *    set; missing/extra webs (e.g. two dropped `andi ...,0xffff` temporaries)
 *    prove the SOURCE differs, and no allocator research can fix that.
 *
 * This module is target-agnostic: it operates on any MIPS instruction stream
 * shaped as { mnemonic, operands } and is safe for both objdump-derived
 * DisassembledInstruction and cc1-derived NormalizedInstruction inputs.
 */

export interface InstructionLike {
  mnemonic: string;
  operands: string[];
  relocation?: { type: string; symbol: string } | string;
}

export const WEB_REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];
const REGISTER_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9_$])\\$?(${WEB_REGISTER_NAMES.join("|")})(?=$|[^A-Za-z0-9_])`,
  "gi",
);

/** Registers whose webs are not interesting for parity (fixed roles). */
const FIXED_REGISTERS = new Set(["zero", "at", "sp", "gp", "fp", "ra", "k0", "k1"]);

const DESTINATION_FIRST = new Set([
  "add", "addu", "addi", "addiu", "sub", "subu", "and", "andi", "or", "ori",
  "xor", "xori", "nor", "slt", "sltu", "slti", "sltiu", "sll", "sllv",
  "sra", "srav", "srl", "srlv", "lui", "li", "la", "move", "negu", "not",
  "mfhi", "mflo", "lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr",
  /* coprocessor→GPR moves define their first operand (GTE/COP0 reads) */
  "mfc0", "mfc1", "mfc2", "cfc0", "cfc1", "cfc2",
]);
const LOADS = new Set(["lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr"]);
const STORES = new Set(["sb", "sh", "sw", "swl", "swr"]);
export const BRANCH_MNEMONICS = new Set([
  "b", "beq", "beql", "beqz", "beqzl", "bne", "bnel", "bnez", "bnezl",
  "bgez", "bgezl", "bgtz", "bgtzl", "blez", "blezl", "bltz", "bltzl",
  "bgezal", "bltzal", "j", "jr",
]);
const CALLS = new Set(["jal", "jalr", "bal", "bgezal", "bltzal"]);
const HILO_DEFS = new Set(["mult", "multu", "div", "divu"]);

export function registersIn(text: string): string[] {
  const result: string[] = [];
  REGISTER_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(REGISTER_PATTERN)) result.push(match[2].toLowerCase());
  return result;
}

export interface DefUse {
  defs: string[];
  uses: string[];
  isCall: boolean;
  isLoad: boolean;
  isStore: boolean;
  isBranch: boolean;
}

/** Architectural defs/uses of one instruction (no call-clobber modeling). */
export function defUse(instruction: InstructionLike): DefUse {
  const mnemonic = instruction.mnemonic.toLowerCase();
  const defs: string[] = [];
  const uses: string[] = [];

  instruction.operands.forEach((operand, index) => {
    const registers = registersIn(operand);
    if (index === 0 && DESTINATION_FIRST.has(mnemonic) && registers.length > 0) {
      defs.push(registers[0]);
      uses.push(...registers.slice(1));
    } else {
      uses.push(...registers);
    }
  });

  if (mnemonic === "jal" || mnemonic === "bal" || mnemonic === "bgezal" || mnemonic === "bltzal") defs.push("ra");
  if (mnemonic === "jalr") {
    /* jalr rd, rs — one-operand form defaults rd to ra. */
    if (instruction.operands.length >= 2) {
      const rd = registersIn(instruction.operands[0])[0];
      if (rd) {
        defs.push(rd);
        const dropIndex = uses.indexOf(rd);
        if (dropIndex >= 0) uses.splice(dropIndex, 1);
      }
    } else defs.push("ra");
  }
  if (HILO_DEFS.has(mnemonic)) defs.push("hi", "lo");
  if (mnemonic === "mfhi") uses.push("hi");
  if (mnemonic === "mflo") uses.push("lo");
  if (mnemonic === "mthi") defs.push("hi");
  if (mnemonic === "mtlo") defs.push("lo");

  return {
    defs,
    uses,
    isCall: CALLS.has(mnemonic),
    isLoad: LOADS.has(mnemonic),
    isStore: STORES.has(mnemonic),
    isBranch: BRANCH_MNEMONICS.has(mnemonic),
  };
}

function relocationKey(relocation: InstructionLike["relocation"]): string {
  if (!relocation) return "";
  const text = typeof relocation === "string"
    ? relocation
    : `${relocation.type}:${relocation.symbol}`;
  const kind = /hi/i.test(text) ? "hi" : /lo/i.test(text) ? "lo" : /gprel|gp_rel/i.test(text) ? "gp" : /26|jal/i.test(text) ? "26" : "rel";
  const symbol = text.toLowerCase().replace(/\s*[+-]\s*0x[0-9a-f]+\)?$/, "");
  const address = symbol.match(/([0-9a-f]{8})/);
  return `|${kind}:${address ? address[1] : symbol.replace(/^.*[:(]/, "").replace(/\)$/, "")}`;
}

/** Canonicalize `%hi(sym)`-style reloc markers embedded in operand text so
 *  objdump-derived and cc1-derived spellings of one symbol compare equal. */
function canonicalizeRelocText(operand: string): string {
  return operand.replace(/%(hi|lo|gp_rel|gprel|call16|got)\(([^)]*)\)/gi, (_whole, kind: string, symbol: string) => {
    const lowered = symbol.toLowerCase();
    const address = lowered.match(/([0-9a-f]{8})/);
    return `%${kind.toLowerCase().replace("gprel", "gp_rel")}(${address ? address[1] : lowered})`;
  });
}

/**
 * Structural shape of an instruction: registers masked, immediates and
 * relocation identity kept, branch/jump targets masked (they shift with
 * layout). Used as the alignment key so streams differing only by register
 * allocation align perfectly. Relocation identity is taken from operand text
 * when present (cc1 assembly spells it inline) and from the relocation field
 * otherwise (objdump reports it separately) — never both, so the two
 * representations of the same instruction produce one shape.
 */
export function shapeKey(instruction: InstructionLike): string {
  let mnemonic = instruction.mnemonic.toLowerCase();
  /* Canonicalize indirect-call aliases: objdump prints `jalr a3`, cc1 prints
     `jal ra,a3` for the same encoding. Normalize both to `jalr <reg>`. */
  const callRegisters = (mnemonic === "jal" || mnemonic === "jalr")
    ? instruction.operands.flatMap((operand) => registersIn(operand)).filter((register) => register !== "ra")
    : [];
  if (callRegisters.length > 0) return "jalr <reg>";
  let relocInText = false;
  const operands = instruction.operands.map((rawOperand) => {
    let operand = rawOperand.toLowerCase().replace(/\s+/g, "");
    if (/%(hi|lo|gp_rel|gprel|call16|got)\(/i.test(operand)) {
      relocInText = true;
      operand = canonicalizeRelocText(operand);
    }
    operand = operand.replace(REGISTER_PATTERN, (_whole, prefix: string) => `${prefix}<reg>`);
    if (BRANCH_MNEMONICS.has(mnemonic) || CALLS.has(mnemonic)) {
      /* Mask non-register target operands: raw addresses and labels shift. */
      if (!operand.includes("<reg>")) operand = "<tgt>";
      /* Drop objdump `<symbol+0x..>` annotations. */
      operand = operand.replace(/<[a-z_.$][^>]*>$/i, "").trim() || "<tgt>";
    }
    return operand;
  });
  const suffix = relocInText ? "" : relocationKey(instruction.relocation);
  return `${mnemonic} ${operands.join(",")}${suffix}`;
}

export interface RegisterWeb {
  register: string;
  version: number; /* 0 = live-at-entry web */
  defIndex: number; /* -1 for entry webs */
  defShape: string; /* shapeKey of the defining instruction, or "entry" */
  defText: string;
  refCount: number; /* use occurrences, not counting the def itself */
  lastUseIndex: number;
  useIndexes: number[];
}

export interface WebOptions {
  /** Model calls as defining the return registers (default true). */
  callsDefineReturns?: boolean;
}

function instructionText(instruction: InstructionLike): string {
  return `${instruction.mnemonic} ${instruction.operands.join(",")}`;
}

/**
 * Linear-scan register webs: each definition opens a new web; each use
 * attaches to the current web of that register. Uses before any definition
 * attach to a version-0 "entry" web (live-at-entry — itself a fingerprint:
 * an entry web on $v0/$v1/$t* is the hard-register entry-liveness anomaly).
 *
 * Control flow is intentionally ignored (linear approximation). Both sides
 * of a comparison pass through the same approximation, so parity comparisons
 * stay meaningful; individual webs near merges may be conservatively fused.
 */
export function computeWebs(instructions: InstructionLike[], options: WebOptions = {}): RegisterWeb[] {
  const callsDefineReturns = options.callsDefineReturns !== false;
  const webs: RegisterWeb[] = [];
  const current = new Map<string, RegisterWeb>();
  const versions = new Map<string, number>();

  const open = (register: string, defIndex: number, instruction: InstructionLike | null): RegisterWeb => {
    const version = defIndex < 0 ? 0 : (versions.get(register) || 0) + 1;
    versions.set(register, version);
    const web: RegisterWeb = {
      register,
      version,
      defIndex,
      defShape: instruction ? shapeKey(instruction) : "entry",
      defText: instruction ? instructionText(instruction) : "entry",
      refCount: 0,
      lastUseIndex: defIndex,
      useIndexes: [],
    };
    webs.push(web);
    current.set(register, web);
    return web;
  };

  instructions.forEach((instruction, index) => {
    const { defs, uses, isCall } = defUse(instruction);
    for (const register of uses) {
      const web = current.get(register) || open(register, -1, null);
      web.refCount++;
      web.lastUseIndex = index;
      web.useIndexes.push(index);
    }
    for (const register of defs) open(register, index, instruction);
    if (isCall && callsDefineReturns) {
      /* The callee's return defines v0/v1; treat post-call reads as a new web. */
      open("v0", index, instruction);
      open("v1", index, instruction);
    }
  });
  return webs;
}

export function summarizeWeb(web: RegisterWeb): string {
  const where = web.defIndex < 0 ? "entry" : `def[${web.defIndex}] ${web.defText}`;
  return `$${web.register}#${web.version} ${where} (${web.refCount} use${web.refCount === 1 ? "" : "s"}, last [${web.lastUseIndex}])`;
}

export interface WebParityReport {
  parity: boolean;
  matchedCount: number;
  looseMatches: Array<{ target: RegisterWeb; compiled: RegisterWeb }>;
  targetOnly: RegisterWeb[];
  compiledOnly: RegisterWeb[];
  entryOnlyTarget: RegisterWeb[];
  entryOnlyCompiled: RegisterWeb[];
}

function interestingWeb(web: RegisterWeb): boolean {
  if (FIXED_REGISTERS.has(web.register)) return false;
  if (web.register === "hi" || web.register === "lo") return false;
  /* A def with zero uses that is immediately shadowed carries no signal
     for parity (e.g. call-return pseudo-defs that are never read). */
  if (web.defIndex >= 0 && web.refCount === 0 && web.defShape.startsWith("jal")) return false;
  return true;
}

/**
 * Compare the web SETS of two streams. A pure register-allocation difference
 * preserves the web multiset (same defining shapes, same use counts) under
 * renaming; unmatched webs mean the pseudo populations differ — a source
 * semantics problem, not an allocator problem.
 */
export function compareWebs(target: RegisterWeb[], compiled: RegisterWeb[]): WebParityReport {
  const targetReal = target.filter((web) => interestingWeb(web) && web.defIndex >= 0);
  const compiledReal = compiled.filter((web) => interestingWeb(web) && web.defIndex >= 0);
  const targetEntry = target.filter((web) => interestingWeb(web) && web.defIndex < 0);
  const compiledEntry = compiled.filter((web) => interestingWeb(web) && web.defIndex < 0);

  const exactKey = (web: RegisterWeb) => `${web.defShape}|uses:${web.refCount}`;
  const remainingCompiled = new Map<string, RegisterWeb[]>();
  for (const web of compiledReal) {
    const list = remainingCompiled.get(exactKey(web)) || [];
    list.push(web);
    remainingCompiled.set(exactKey(web), list);
  }

  let matchedCount = 0;
  const unmatchedTarget: RegisterWeb[] = [];
  for (const web of targetReal) {
    const list = remainingCompiled.get(exactKey(web));
    if (list && list.length > 0) {
      list.shift();
      matchedCount++;
    } else unmatchedTarget.push(web);
  }
  const unmatchedCompiled = [...remainingCompiled.values()].flat();

  /* Second pass: same defining shape, different use count — report as loose. */
  const looseMatches: Array<{ target: RegisterWeb; compiled: RegisterWeb }> = [];
  const targetOnly: RegisterWeb[] = [];
  const byShape = new Map<string, RegisterWeb[]>();
  for (const web of unmatchedCompiled) {
    const list = byShape.get(web.defShape) || [];
    list.push(web);
    byShape.set(web.defShape, list);
  }
  for (const web of unmatchedTarget) {
    const list = byShape.get(web.defShape);
    if (list && list.length > 0) looseMatches.push({ target: web, compiled: list.shift()! });
    else targetOnly.push(web);
  }
  const compiledOnly = [...byShape.values()].flat();

  /* Entry webs matched by register name: an entry web present on one side
     only is the entry-liveness fingerprint. */
  const compiledEntryNames = new Set(compiledEntry.map((web) => web.register));
  const targetEntryNames = new Set(targetEntry.map((web) => web.register));
  const entryOnlyTarget = targetEntry.filter((web) => !compiledEntryNames.has(web.register));
  const entryOnlyCompiled = compiledEntry.filter((web) => !targetEntryNames.has(web.register));

  return {
    parity: targetOnly.length === 0 && compiledOnly.length === 0 &&
      entryOnlyTarget.length === 0 && entryOnlyCompiled.length === 0,
    matchedCount,
    looseMatches,
    targetOnly,
    compiledOnly,
    entryOnlyTarget,
    entryOnlyCompiled,
  };
}

/** LCS alignment of two streams on structural shape. Returns index pairs. */
export function alignByShape(
  target: InstructionLike[],
  compiled: InstructionLike[],
): Array<[number, number]> {
  const left = target.map(shapeKey);
  const right = compiled.map(shapeKey);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: Uint32Array[] = Array.from({ length: rows }, () => new Uint32Array(cols));
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

export interface ProvenanceDivergence {
  targetIndex: number;
  compiledIndex: number;
  register: string;
  compiledRegister: string;
  targetText: string;
  compiledText: string;
  targetDefIndex: number; /* -1 = live-at-entry */
  compiledDefIndex: number;
  targetDefText: string;
  compiledDefText: string;
  reason: "entry-vs-defined" | "defs-not-aligned";
}

/**
 * Value-provenance audit: for each shape-aligned instruction pair, trace each
 * use-operand register's last definition on both sides and flag pairs whose
 * defining instructions do not correspond. Catches "same register name,
 * different value" — invisible to any name-based or reloc-masked diff.
 *
 * In a pure allocation rotation every def aligns pairwise, so this produces
 * no findings; a finding is positive evidence of a semantic divergence.
 */
export function provenanceAudit(
  target: InstructionLike[],
  compiled: InstructionLike[],
  pairs?: Array<[number, number]>,
): ProvenanceDivergence[] {
  const alignment = pairs || alignByShape(target, compiled);
  const targetToCompiled = new Map(alignment);

  const lastDefs = (instructions: InstructionLike[]): Array<Map<string, number>> => {
    const current = new Map<string, number>();
    const snapshots: Array<Map<string, number>> = [];
    for (let index = 0; index < instructions.length; index++) {
      snapshots.push(new Map(current));
      const { defs, isCall } = defUse(instructions[index]);
      for (const register of defs) current.set(register, index);
      if (isCall) {
        current.set("v0", index);
        current.set("v1", index);
      }
    }
    return snapshots;
  };
  const targetDefs = lastDefs(target);
  const compiledDefs = lastDefs(compiled);

  const findings: ProvenanceDivergence[] = [];
  const seen = new Set<string>();
  for (const [targetIndex, compiledIndex] of alignment) {
    const leftUse = defUse(target[targetIndex]);
    const rightUse = defUse(compiled[compiledIndex]);
    const count = Math.min(leftUse.uses.length, rightUse.uses.length);
    for (let occurrence = 0; occurrence < count; occurrence++) {
      const leftRegister = leftUse.uses[occurrence];
      const rightRegister = rightUse.uses[occurrence];
      if (FIXED_REGISTERS.has(leftRegister) || FIXED_REGISTERS.has(rightRegister)) continue;
      const leftDef = targetDefs[targetIndex].get(leftRegister) ?? -1;
      const rightDef = compiledDefs[compiledIndex].get(rightRegister) ?? -1;

      let reason: ProvenanceDivergence["reason"] | null = null;
      if ((leftDef < 0) !== (rightDef < 0)) reason = "entry-vs-defined";
      else if (leftDef >= 0 && rightDef >= 0 && targetToCompiled.get(leftDef) !== rightDef) {
        reason = "defs-not-aligned";
      }
      if (!reason) continue;

      const key = `${leftDef}:${rightDef}:${leftRegister}:${rightRegister}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        targetIndex,
        compiledIndex,
        register: leftRegister,
        compiledRegister: rightRegister,
        targetText: instructionText(target[targetIndex]),
        compiledText: instructionText(compiled[compiledIndex]),
        targetDefIndex: leftDef,
        compiledDefIndex: rightDef,
        targetDefText: leftDef < 0 ? "live at entry" : instructionText(target[leftDef]),
        compiledDefText: rightDef < 0 ? "live at entry" : instructionText(compiled[rightDef]),
        reason,
      });
    }
  }
  return findings;
}

export interface BagDelta {
  targetOnly: Map<string, number>;
  compiledOnly: Map<string, number>;
}

/** Multiset difference of structural shapes — decomposes an instruction-count
 *  delta into concrete missing/extra instructions. */
export function bagDelta(target: InstructionLike[], compiled: InstructionLike[]): BagDelta {
  const counts = new Map<string, number>();
  for (const instruction of target) {
    const key = shapeKey(instruction);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const instruction of compiled) {
    const key = shapeKey(instruction);
    counts.set(key, (counts.get(key) || 0) - 1);
  }
  const targetOnly = new Map<string, number>();
  const compiledOnly = new Map<string, number>();
  for (const [key, count] of counts) {
    if (count > 0) targetOnly.set(key, count);
    else if (count < 0) compiledOnly.set(key, -count);
  }
  return { targetOnly, compiledOnly };
}

export function formatBagDelta(delta: BagDelta, limit = 6): string[] {
  const lines: string[] = [];
  const render = (label: string, bag: Map<string, number>) => {
    if (bag.size === 0) return;
    const entries = [...bag.entries()].sort((a, b) => b[1] - a[1]);
    const shown = entries.slice(0, limit)
      .map(([shape, count]) => (count > 1 ? `${count}× ${shape}` : shape))
      .join("; ");
    const more = entries.length > limit ? ` (+${entries.length - limit} more shapes)` : "";
    lines.push(`${label}: ${shown}${more}`);
  };
  render("target-only shapes", delta.targetOnly);
  render("compiled-only shapes", delta.compiledOnly);
  return lines;
}

export interface BasicBlock {
  start: number;
  end: number; /* inclusive; the delay slot of a terminating branch is inside */
  successors: number[]; /* block start indexes */
}

/**
 * Build basic blocks over a MIPS instruction stream with delay slots.
 * `branchTargetOf` maps an instruction index to its target INSTRUCTION index
 * (undefined for indirect/external targets like jr/jalr/jal).
 */
export function buildBlocks(
  instructions: InstructionLike[],
  branchTargetOf: (index: number) => number | undefined,
): BasicBlock[] {
  const leaders = new Set<number>([0]);
  instructions.forEach((instruction, index) => {
    const mnemonic = instruction.mnemonic.toLowerCase();
    if (!BRANCH_MNEMONICS.has(mnemonic)) return;
    const targetIndex = branchTargetOf(index);
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < instructions.length) {
      leaders.add(targetIndex);
    }
    if (index + 2 < instructions.length) leaders.add(index + 2); /* past delay slot */
  });

  const starts = [...leaders].sort((a, b) => a - b);
  const blocks: BasicBlock[] = [];
  for (let blockIndex = 0; blockIndex < starts.length; blockIndex++) {
    const start = starts[blockIndex];
    const end = (blockIndex + 1 < starts.length ? starts[blockIndex + 1] : instructions.length) - 1;
    if (end < start) continue;
    const successors: number[] = [];
    /* The terminator, if any, is the branch whose delay slot ends the block. */
    let terminator = -1;
    for (let index = start; index <= end; index++) {
      if (BRANCH_MNEMONICS.has(instructions[index].mnemonic.toLowerCase())) terminator = index;
    }
    if (terminator >= 0 && terminator >= end - 1) {
      const mnemonic = instructions[terminator].mnemonic.toLowerCase();
      const targetIndex = branchTargetOf(terminator);
      if (targetIndex !== undefined) successors.push(targetIndex);
      const unconditional = mnemonic === "j" || mnemonic === "b" || mnemonic === "jr";
      if (!unconditional && end + 1 < instructions.length) successors.push(end + 1);
    } else if (end + 1 < instructions.length) {
      successors.push(end + 1);
    }
    blocks.push({ start, end, successors });
  }
  return blocks;
}
