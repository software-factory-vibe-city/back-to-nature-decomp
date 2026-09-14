/**
 * Family signatures — a shape for one function's original words, with the
 * parts that vary between members of a family left as holes.
 *
 * The retrieval this supports is not "find similar C": on day one there is no
 * C to be similar to. The query is the target's own machine words, and a hit
 * is another function whose words have the same shape. When one of those hits
 * is matched, its C is a *donor*: the same shape compiled from source, with
 * the holes filled in differently.
 *
 * Three tiers, because they answer different questions:
 *
 *   - `strict` keeps every immediate and register, abstracting only what is
 *     never a source-level choice — internal branch distances and the
 *     addresses of symbols. Two functions with the same strict signature
 *     differ only in which symbols they name.
 *   - `flexible` additionally makes immediates holes. This is the tier that
 *     finds a family whose members differ in a field offset, a table stride,
 *     or a loop bound — the case the investigation actually closed, where two
 *     neighbours differed in one halfword offset (0xAC against 0xAA).
 *   - `shape` additionally renumbers scratch registers by first use, which is
 *     what a *recipe* lookup needs: two compilations of one construction
 *     differ in which temporary the allocator picked, and that difference is
 *     the compiler's, not the source's.
 *
 * Every hole records the concrete value *this* function has, so a signature is
 * a template plus an instantiation, never a lossy hash. That is what makes a
 * donor's C usable: the transfer needs to know which literal to change and to
 * what, not merely that two functions look alike.
 */

import { readFileSync } from "node:fs";
import { containerTargetPath, vramToRom, type Container } from "../../lib/container.js";
import { loadSymbolIndex, requireFunctionLocation, resolveAddress } from "../../lib/symbolIndex.js";
import { decodeBytes } from "../matching-reconstruction/exec.js";
import { isBranch, isLoad, isStore, type DecodedInsn } from "../matching-reconstruction/decode.js";

/**
 * How much of a function's words a signature keeps.
 *
 * `strict` and `flexible` are for *family* retrieval, where two members share
 * an allocation because they are the same code compiled twice; keeping
 * registers is what makes the match mean something.
 *
 * `shape` is for *recipe* retrieval, which asks the opposite question — "which
 * source construction is this?" — and there the allocation is the compiler's
 * choice, not the source's. Scratch registers are renumbered by first use, so
 * two compilations of one construction that differ only in which temporary the
 * allocator picked have one shape. The ABI-meaningful registers keep their
 * identity: `$a0` is the first parameter in both programs, and normalising it
 * would merge constructions that read different arguments.
 */
export type SignatureTier = "strict" | "flexible" | "shape";

/** What varies at one position, and what value this function has there. */
export type HoleKind =
  /** A memory-access displacement: a structure offset or an array base. */
  | "displacement"
  /** An arithmetic or logical immediate. */
  | "immediate"
  /** A shift amount — a scale, so a distinct kind from a plain immediate. */
  | "shift"
  /** The upper half of a materialized address. Paired with a `symbol-lo`. */
  | "symbol-hi"
  /**
   * A `lui` no low half ever completes.
   *
   * This is not an address: it is a constant the compiler placed in the high
   * half so a following `sra` could produce a narrowed sum — `(s16)(x + 8)`
   * becomes `sll;lui 0x8;addu;sra`, where the source literal is 8 and the
   * machine's is 0x80000. The source-level value is the machine value shifted
   * back down, and a transfer that substituted the machine value would edit
   * the wrong number.
   */
  | "immediate-hi"
  /** The lower half; carries the resolved absolute address and symbol. */
  | "symbol-lo"
  /** A direct call target. */
  | "callee";

export interface Hole {
  /** Instruction index within the function. */
  index: number;
  vram: number;
  kind: HoleKind;
  /** The value this function has: an immediate, or an absolute address. */
  value: number;
  /** Symbol covering `value`, when the tables know one (address holes only). */
  symbol?: string;
  /** Byte offset of `value` from that symbol. */
  symbolOffset?: number;
  /** Index of the paired `symbol-hi` hole, for a `symbol-lo`. */
  pairedWith?: number;
  /**
   * Set on a `symbol-hi` some `symbol-lo` completes. A paired high half is
   * redundant — substituting the low half's symbol settles both — so a
   * transfer must not treat it as a separate thing to place.
   */
  paired?: boolean;
}

export interface FamilySignature {
  functionName: string;
  containerId: string;
  vram: number;
  words: number;
  tier: SignatureTier;
  /** One token per instruction; holes appear as `?`. */
  tokens: string[];
  /** Stable digest of `tokens` — the family key. */
  shape: string;
  holes: Hole[];
}

/* ---- token construction --------------------------------------------------- */

/**
 * Registers with a fixed architectural role, which the `shape` tier keeps.
 *
 * `$zero`, `$gp`, `$sp`, `$fp` and `$ra` mean the same thing in every
 * function. The argument registers deliberately are *not* in this set: a
 * function's first parameter arrives in `$a0` in both programs and so
 * renumbers to the same position, while `$a1` and `$a2` are ordinary scratch
 * once their arguments are consumed — and treating them as fixed made two
 * compilations of one loop differ only because the allocator put the
 * accumulator in a different one.
 */
const ABI_REGISTERS = new Set([0, 28, 29, 30, 31]);

/**
 * Register naming for one signature.
 *
 * In the `shape` tier a scratch register becomes `t<n>` by order of first
 * appearance, so the allocator's choice does not distinguish two compilations
 * of the same construction. Everywhere else the register index is the name.
 */
function registerNamer(tier: SignatureTier): (index: number) => string {
  if (tier !== "shape") return (index: number) => `r${index}`;
  const order = new Map<number, number>();
  return (index: number) => {
    if (ABI_REGISTERS.has(index)) return `r${index}`;
    let position = order.get(index);
    if (position === undefined) {
      position = order.size;
      order.set(index, position);
    }
    return `t${position}`;
  };
}

/**
 * Tokenize one instruction, appending any hole it introduces.
 *
 * Branch and jump targets inside the function become word-relative distances:
 * two members of a family sit at different addresses, and an absolute target
 * would make every member's signature unique for no source-level reason.
 */
function tokenOf(
  insn: DecodedInsn,
  index: number,
  tier: SignatureTier,
  startVram: number,
  holes: Hole[],
  addressAt: Map<number, { address: number; hi: number }>,
  reg: (register: number) => string,
): string {
  const hole = (kind: HoleKind, value: number, extra: Partial<Hole> = {}): string => {
    holes.push({ index, vram: insn.vram, kind, value, ...extra });
    return "?";
  };

  switch (insn.op) {
    case "nop":
      return "nop";
    case "unknown":
      /* An unmodelled word still has a shape: its opcode class. Signatures are
       * a retrieval index, not a semantic model, so a family of functions that
       * all contain the same unaligned copy is still a family. */
      return `raw:${((insn.word >>> 26) & 0x3f).toString(16)}:${(insn.word & 0x3f).toString(16)}`;
    case "lui": {
      /* Almost every `lui` in compiled code is the top half of an address. It
       * is a hole in both tiers: two members of one family naming different
       * globals are the same shape. */
      return `lui ${reg(insn.rt)},${hole("symbol-hi", (insn.uimm << 16) >>> 0)}`;
    }
    case "jal": {
      return `jal ${hole("callee", insn.target ?? 0)}`;
    }
    case "j":
      return `j ${((insn.target ?? insn.vram) - startVram) / 4}`;
    case "jr":
      return `jr ${reg(insn.rs)}`;
    case "jalr":
      return `jalr ${reg(insn.rs)},${reg(insn.rd)}`;
    case "sll": case "srl": case "sra":
      return `${insn.op} ${reg(insn.rd)},${reg(insn.rt)},${tier === "strict" ? insn.shamt : hole("shift", insn.shamt)}`;
    default:
      break;
  }

  if (isBranch(insn.op)) {
    const delta = insn.target === undefined ? 0 : (insn.target - insn.vram) / 4;
    return `${insn.op} ${reg(insn.rs)},${reg(insn.rt)},${delta}`;
  }

  if (isLoad(insn.op) || isStore(insn.op)) {
    /* A displacement completing a materialized address is the low half of a
     * symbol reference, not a structure offset — a different kind of hole,
     * because the substitution a transfer makes for it is a symbol name
     * rather than a number. */
    const pending = addressAt.get(insn.rs);
    if (pending) {
      const address = (pending.hi + insn.simm) >>> 0;
      return `${insn.op} ${reg(insn.rt)},${hole("symbol-lo", address, { pairedWith: pending.address })}(${reg(insn.rs)})`;
    }
    const displacement = tier === "strict" ? String(insn.simm) : hole("displacement", insn.simm);
    return `${insn.op} ${reg(insn.rt)},${displacement}(${reg(insn.rs)})`;
  }

  switch (insn.op) {
    case "addiu": case "addi": case "slti": case "sltiu": {
      const pending = addressAt.get(insn.rs);
      if (pending) {
        const address = (pending.hi + insn.simm) >>> 0;
        return `${insn.op} ${reg(insn.rt)},${reg(insn.rs)},${hole("symbol-lo", address, { pairedWith: pending.address })}`;
      }
      return `${insn.op} ${reg(insn.rt)},${reg(insn.rs)},${tier === "strict" ? insn.simm : hole("immediate", insn.simm)}`;
    }
    case "andi": case "ori": case "xori": {
      const pending = insn.op === "ori" ? addressAt.get(insn.rs) : undefined;
      if (pending) {
        const address = (pending.hi + insn.uimm) >>> 0;
        return `${insn.op} ${reg(insn.rt)},${reg(insn.rs)},${hole("symbol-lo", address, { pairedWith: pending.address })}`;
      }
      return `${insn.op} ${reg(insn.rt)},${reg(insn.rs)},${tier === "strict" ? insn.uimm : hole("immediate", insn.uimm)}`;
    }
    case "sllv": case "srlv": case "srav":
      return `${insn.op} ${reg(insn.rd)},${reg(insn.rt)},${reg(insn.rs)}`;
    case "mult": case "multu": case "div": case "divu":
      return `${insn.op} ${reg(insn.rs)},${reg(insn.rt)}`;
    case "mfhi": case "mflo":
      return `${insn.op} ${reg(insn.rd)}`;
    default:
      return `${insn.op} ${reg(insn.rd)},${reg(insn.rs)},${reg(insn.rt)}`;
  }
}

/** A stable digest of a token list — short enough to be a map key. */
function digest(tokens: string[]): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  const text = tokens.join("\n");
  for (let index = 0; index < text.length; index++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(index), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(index), 0x85ebca6b) >>> 0;
  }
  return `${tokens.length}:${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/**
 * Build the signature for one function's decoded words.
 *
 * `resolve` maps an absolute address to its symbol, when the tables know one.
 * It is optional: retrieval works without symbols, and only the transfer step
 * needs names.
 */
export function signatureOf(
  functionName: string,
  containerId: string,
  insns: DecodedInsn[],
  tier: SignatureTier,
  resolve?: (address: number) => { symbol: string; offset: number } | null,
): FamilySignature {
  const startVram = insns[0]?.vram ?? 0;
  const holes: Hole[] = [];
  const tokens: string[] = [];
  /* Register → the high half it currently carries, and the hole index that
   * produced it. Cleared when the register is redefined by anything else. */
  const addressAt = new Map<number, { address: number; hi: number }>();
  const reg = registerNamer(tier);

  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    const before = holes.length;
    tokens.push(tokenOf(insn, index, tier, startVram, holes, addressAt, reg));

    if (insn.op === "lui") {
      addressAt.set(insn.rt, { address: before, hi: (insn.uimm << 16) >>> 0 });
      continue;
    }
    /* Whatever the instruction writes stops carrying a high half — including
     * the register the low half was just added into, which now holds a
     * complete address rather than half of one. The source was already read
     * above, so clearing here is safe for `addiu rt,rt,lo`. */
    const writesRt = isLoad(insn.op) || ["addiu", "addi", "slti", "sltiu", "andi", "ori", "xori"].includes(insn.op);
    const writesRd = ["addu", "subu", "and", "or", "xor", "nor", "slt", "sltu",
      "sll", "srl", "sra", "sllv", "srlv", "srav", "mfhi", "mflo"].includes(insn.op);
    if (writesRt) addressAt.delete(insn.rt);
    else if (writesRd) addressAt.delete(insn.rd);
    else if (insn.op === "jal" || insn.op === "jalr") addressAt.clear();
  }

  /* Pairing, then reclassification. A `lui` nothing completes is a constant
   * materialization, not an address — see the `immediate-hi` note. */
  for (const hole of holes) {
    if (hole.kind !== "symbol-lo" || hole.pairedWith === undefined) continue;
    const high = holes[hole.pairedWith];
    if (high && high.kind === "symbol-hi") high.paired = true;
  }
  for (const hole of holes) {
    if (hole.kind === "symbol-hi" && !hole.paired) hole.kind = "immediate-hi";
  }

  if (resolve) {
    for (const hole of holes) {
      if (hole.kind !== "symbol-lo" && hole.kind !== "callee") continue;
      const resolved = resolve(hole.value >>> 0);
      if (!resolved) continue;
      hole.symbol = resolved.symbol;
      hole.symbolOffset = resolved.offset;
    }
  }

  return {
    functionName,
    containerId,
    vram: startVram,
    words: insns.length,
    tier,
    tokens,
    shape: digest(tokens),
    holes,
  };
}

/* ---- loading a function's words ------------------------------------------- */

const imageCache = new Map<string, Buffer>();

function containerImage(container: Container): Buffer {
  const path = containerTargetPath(container);
  const cached = imageCache.get(path);
  if (cached) return cached;
  const image = readFileSync(path);
  imageCache.set(path, image);
  return image;
}

/** Decode one function straight out of its container image. */
export function decodeFunctionWords(functionName: string): {
  insns: DecodedInsn[];
  container: Container;
  vram: number;
  sizeBytes: number;
} {
  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const span = location.span;
  const image = containerImage(container);
  const rom = vramToRom(container, span.vram);
  return {
    insns: decodeBytes(image.subarray(rom, rom + span.size), span.vram),
    container,
    vram: span.vram,
    sizeBytes: span.size,
  };
}

const resolverCache = new Map<string, (address: number) => { symbol: string; offset: number } | null>();

/** A symbol resolver for one container, memoized — the index is not cheap. */
export function symbolResolverFor(container: Container): (address: number) => { symbol: string; offset: number } | null {
  const cached = resolverCache.get(container.id);
  if (cached) return cached;
  let index: ReturnType<typeof loadSymbolIndex> | undefined;
  try {
    index = loadSymbolIndex(container);
  } catch {
    index = undefined;
  }
  const resolver = (address: number) => (index ? resolveAddress(index, address >>> 0) : null);
  resolverCache.set(container.id, resolver);
  return resolver;
}

/** Signature for one named function, loading and decoding it. */
export function signatureFor(functionName: string, tier: SignatureTier): FamilySignature {
  const { insns, container, vram } = decodeFunctionWords(functionName);
  void vram;
  return signatureOf(functionName, container.id, insns, tier, symbolResolverFor(container));
}
