/**
 * overlayBase.ts — solve the load address of an overlay member.
 *
 * Deliverable 3 of plans/overlay-decompilation-enablement.md, and the linchpin:
 * an overlay carries no header and no relocation table, so nothing downstream
 * of it is meaningful until the base is known. Branch targets are PC-relative
 * and survive any base; `jal`/`j` targets, `lui` pairs, jump tables and pointer
 * tables are absolute and are noise at the wrong base.
 *
 * The derivation is a vote. Every self-referencing `jal` target is the address
 * of a function entry, and every stack prologue in the member is a candidate
 * function entry, so each (target, prologue) pair proposes one base. The
 * correct base is proposed by almost every target at once; a wrong one is
 * proposed by coincidence. The winner is then scored against the whole
 * constraint set and issued a certificate, or reported `undetermined` — a
 * plausible default here silently corrupts every artifact built on it.
 */

import {
  isDecodableInstruction,
  isJrRa,
  isStackPrologue,
  isValidRamAddress,
  jTarget,
  jalTarget,
} from "./mips.js";

export interface BaseSolverInput {
  id: string;
  bytes: Buffer;
  /** The PS-X EXE image; `jal` targets inside it are engine calls, not self-references. */
  exeImage: { start: number; end: number };
}

export interface BaseCriterion {
  name: string;
  weight: number;
  value: number;
  detail: string;
}

export interface BaseCandidate {
  base: number;
  votes: number;
  score: number;
  criteria: BaseCriterion[];
  source: "prologue-vote" | "external";
}

export interface BaseCertificate {
  member: string;
  verdict: "resolved" | "undetermined";
  base: number | null;
  score: number;
  /** Score margin over the runner-up base. */
  margin: number;
  runnerUp: number | null;
  criteria: BaseCriterion[];
  /** Constraints the winning base does not satisfy, stated rather than hidden. */
  residuals: string[];
  evidence: string[];
  /** Self-reference targets the member's own extent does not contain. */
  unexplainedTargets: number[];
}

/** A base wins only above this absolute score. */
export const MIN_SCORE = 0.85;
/** …and only this far clear of the runner-up. */
export const MIN_MARGIN = 0.1;

export interface SelfReferences {
  /** Distinct `jal` targets outside the EXE image: this member's own functions. */
  calls: number[];
  /** Distinct `j` targets outside the EXE image: tail calls and long branches. */
  jumps: number[];
  /** `jal`/`j`-shaped words rejected by the RAM-range check. */
  rejected: number;
  /** Offsets of every stack prologue — the candidate function entries. */
  prologues: number[];
  /** The leading run of words that are valid RAM addresses, after the id tag. */
  headPointers: number[];
}

/**
 * Everything in a member that constrains its base.
 *
 * Every candidate target is range-checked before it is used. Embedded data
 * words whose top six bits happen to be opcode 2 or 3 decode as `j`/`jal` to
 * addresses no PS1 ever executes, and an unchecked one moves the vote.
 */
export function collectSelfReferences(input: BaseSolverInput): SelfReferences {
  const { bytes, exeImage } = input;
  const words = Math.floor(bytes.length / 4);
  const calls = new Set<number>();
  const jumps = new Set<number>();
  const prologues: number[] = [];
  let rejected = 0;

  for (let i = 0; i < words; i++) {
    const word = bytes.readUInt32LE(i * 4);
    if (isStackPrologue(word)) prologues.push(i * 4);

    const call = jalTarget(word, 0x80000000);
    if (call !== null) {
      if (!isValidRamAddress(call)) rejected++;
      else if (!(call >= exeImage.start && call < exeImage.end)) calls.add(call);
      continue;
    }
    const jump = jTarget(word, 0x80000000);
    if (jump !== null) {
      if (!isValidRamAddress(jump)) rejected++;
      else if (!(jump >= exeImage.start && jump < exeImage.end)) jumps.add(jump);
    }
  }

  /* Most members open with the overlay id then a run of absolute pointers into
     their own image. The run ends at the first word that is not a RAM address,
     so nothing is assumed about its length. */
  const headPointers: number[] = [];
  for (let i = 1; i < words; i++) {
    const word = bytes.readUInt32LE(i * 4);
    if (!isValidRamAddress(word)) break;
    headPointers.push(word);
  }

  return {
    calls: [...calls].sort((a, b) => a - b),
    jumps: [...jumps].sort((a, b) => a - b),
    rejected,
    prologues,
    headPointers,
  };
}

/** Does the word at this offset look like the first instruction of a function? */
function isEntryShaped(bytes: Buffer, offset: number): boolean {
  const words = Math.floor(bytes.length / 4);
  const index = offset / 4;
  if (!Number.isInteger(index) || index < 0 || index >= words) return false;
  const word = bytes.readUInt32LE(offset);
  if (isStackPrologue(word)) return true;
  /* A leaf function has no frame, but the function before it ended with
     `jr ra` and its delay slot, so the return two words back marks the seam. */
  if (index >= 2 && isJrRa(bytes.readUInt32LE(offset - 8)) && isDecodableInstruction(word)) return true;
  /* The member's first function has nothing before it. */
  return index === 0 && isDecodableInstruction(word);
}

function fraction(matching: number, total: number): number {
  return total === 0 ? 1 : matching / total;
}

/**
 * Score one candidate base.
 *
 * Every criterion is a fraction of the evidence it is measured over, and a
 * criterion with no evidence — a member with no internal `jal`, or no leading
 * pointer table — is dropped rather than scored 1, so a vacuous criterion
 * cannot inflate a candidate that nothing supports.
 *
 * `resolveElsewhere` reports where an address lands in another member's solved
 * extent. Cross-overlay calls are real, so a target the slot mate accounts for
 * counts for the base rather than against it — but only when it lands on a
 * function entry there, which is what stops a wrong base from laundering its
 * misses through a large neighbour.
 */
export interface ElsewhereResolution {
  /** Some other solved member's extent contains the address. */
  contained: boolean;
  /** …and the word at that offset is shaped like a function entry. */
  atEntry: boolean;
  /** …and the word at that offset decodes as an instruction. */
  decodable: boolean;
}

/**
 * Where an address lands in another member's solved extent, given the base
 * being scored. Members solved to the *same* base share a slot and are
 * mutually exclusive in RAM, so one can never reference another; a resolver
 * must exclude them or a wrong base can launder its misses through a large
 * slot mate.
 */
export type ElsewhereResolver = (address: number, candidateBase: number) => ElsewhereResolution;

const NOWHERE: ElsewhereResolution = { contained: false, atEntry: false, decodable: false };

export function scoreBase(
  input: BaseSolverInput,
  refs: SelfReferences,
  base: number,
  resolveElsewhere: ElsewhereResolver = () => NOWHERE,
  slotBases: readonly number[] = []
): BaseCriterion[] {
  const { bytes } = input;
  const size = bytes.length;
  const inside = (address: number) => {
    const offset = address - base;
    return offset >= 0 && offset < size && offset % 4 === 0;
  };

  const callsAtEntry = refs.calls.filter((t) =>
    inside(t) ? isEntryShaped(bytes, t - base) : resolveElsewhere(t, base).atEntry
  );
  const jumpsResolved = refs.jumps.filter((t) =>
    inside(t) ? isDecodableInstruction(bytes.readUInt32LE(t - base)) : resolveElsewhere(t, base).decodable
  );
  const headInside = refs.headPointers.filter(inside);

  const criteria: BaseCriterion[] = [];

  if (refs.calls.length > 0) {
    criteria.push({
      name: "selfCallsAtEntry",
      weight: 0.55,
      value: callsAtEntry.length / refs.calls.length,
      detail: `${callsAtEntry.length}/${refs.calls.length} internal jal targets land on a function entry, here or in a slot mate`,
    });
  }
  if (refs.jumps.length > 0) {
    criteria.push({
      name: "jumpsResolve",
      weight: 0.2,
      value: jumpsResolved.length / refs.jumps.length,
      detail: `${jumpsResolved.length}/${refs.jumps.length} internal j targets land on a decodable instruction, here or in a slot mate`,
    });
  }
  if (refs.headPointers.length > 0) {
    criteria.push({
      name: "headPointersInside",
      weight: 0.15,
      value: headInside.length / refs.headPointers.length,
      detail: `${headInside.length}/${refs.headPointers.length} leading pointer-table entries resolve inside this member`,
    });
  }
  if (slotBases.length > 0) {
    const agrees = slotBases.includes(base);
    criteria.push({
      name: "slotAgreement",
      weight: 0.1,
      value: agrees ? 1 : 0,
      detail: agrees
        ? `base agrees with ${slotBases.filter((b) => b === base).length} other member(s) solved independently`
        : `no other member was solved to this base`,
    });
  }

  return criteria;
}

/** Weighted mean over the criteria that have evidence, so a dropped criterion is neutral. */
export function weighted(criteria: readonly BaseCriterion[]): number {
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (total === 0) return 0;
  return criteria.reduce((sum, c) => sum + c.weight * c.value, 0) / total;
}

/**
 * Candidate bases, ranked.
 *
 * `additional` carries bases solved for other members, so a member whose own
 * evidence is too thin to vote — one with no internal `jal` at all — can still
 * be tested against the slot its references fall in.
 */
export function proposeBases(refs: SelfReferences, size: number, additional: readonly number[] = []): Map<number, number> {
  const votes = new Map<number, number>();
  for (const target of refs.calls) {
    for (const prologue of refs.prologues) {
      const base = target - prologue;
      if (base <= 0) continue;
      /* Every target this base proposes must at least be able to land in the
         member; a base that puts its own proposer outside it is not a base. */
      if (target - base >= size) continue;
      votes.set(base, (votes.get(base) ?? 0) + 1);
    }
  }
  for (const base of additional) if (!votes.has(base)) votes.set(base, 0);
  return votes;
}

export interface SolveOptions {
  /** Bases solved for *other* members, offered as candidates and as slot evidence. */
  externalBases?: readonly number[];
  /** Where an address lands in another member's solved extent. */
  resolveElsewhere?: ElsewhereResolver;
  /** How many top-voted candidates to score. */
  scoreTop?: number;
}

export function solveMemberBase(input: BaseSolverInput, options: SolveOptions = {}): BaseCertificate {
  const refs = collectSelfReferences(input);
  const resolveElsewhere: ElsewhereResolver = options.resolveElsewhere ?? (() => NOWHERE);
  const externalBases = options.externalBases ?? [];
  const scoreTop = options.scoreTop ?? 24;

  const evidence = [
    `${refs.calls.length} distinct internal jal targets, ${refs.jumps.length} internal j targets`,
    `${refs.prologues.length} stack prologues offered as candidate function entries`,
    `${refs.rejected} jal/j-shaped words rejected by the PS1 RAM range check`,
    `${refs.headPointers.length} leading pointer-table entries`,
  ];

  if (refs.calls.length === 0 && refs.jumps.length === 0 && refs.headPointers.length === 0) {
    return {
      member: input.id,
      verdict: "undetermined",
      base: null,
      score: 0,
      margin: 0,
      runnerUp: null,
      criteria: [],
      residuals: ["the member carries no absolute self-reference, so no constraint bears on its base"],
      evidence,
      unexplainedTargets: [],
    };
  }

  const votes = proposeBases(refs, input.bytes.length, externalBases);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, scoreTop);

  const scored: BaseCandidate[] = ranked
    .map(([base, count]) => {
      const criteria = scoreBase(input, refs, base, resolveElsewhere, externalBases);
      return {
        base,
        votes: count,
        score: weighted(criteria),
        criteria,
        source: (count === 0 ? "external" : "prologue-vote") as BaseCandidate["source"],
      };
    })
    .sort((a, b) => b.score - a.score || b.votes - a.votes);

  const best = scored[0];
  if (!best) {
    return {
      member: input.id,
      verdict: "undetermined",
      base: null,
      score: 0,
      margin: 0,
      runnerUp: null,
      criteria: [],
      residuals: ["no candidate base was proposed"],
      evidence,
      unexplainedTargets: [],
    };
  }

  /* The runner-up must be a genuinely different placement. Bases within one
     instruction of the winner are the same hypothesis off by a word, and
     treating them as rivals would report every solved member undetermined. */
  const runnerUp = scored.find((c) => Math.abs(c.base - best.base) > 4);
  const margin = best.score - (runnerUp?.score ?? 0);

  const inside = (address: number) => {
    const offset = address - best.base;
    return offset >= 0 && offset < input.bytes.length && offset % 4 === 0;
  };
  const unexplained = [...refs.calls, ...refs.jumps].filter(
    (t) => !inside(t) && !resolveElsewhere(t, best.base).contained
  );

  const residuals: string[] = [];
  for (const criterion of best.criteria) {
    if (criterion.value < 1) residuals.push(`${criterion.name}: ${criterion.detail}`);
  }

  evidence.push(
    `winning base 0x${best.base.toString(16).toUpperCase()} proposed by ${best.votes} of ${refs.calls.length} internal jal targets`
  );
  if (runnerUp) {
    evidence.push(
      `runner-up 0x${runnerUp.base.toString(16).toUpperCase()} scores ${runnerUp.score.toFixed(3)} on ${runnerUp.votes} votes`
    );
  }

  if (best.score < MIN_SCORE) {
    return {
      member: input.id,
      verdict: "undetermined",
      base: null,
      score: best.score,
      margin,
      runnerUp: runnerUp?.base ?? null,
      criteria: best.criteria,
      residuals: [...residuals, `best candidate scores ${best.score.toFixed(3)}, below the ${MIN_SCORE} bar`],
      evidence,
      unexplainedTargets: unexplained,
    };
  }
  if (margin < MIN_MARGIN) {
    return {
      member: input.id,
      verdict: "undetermined",
      base: null,
      score: best.score,
      margin,
      runnerUp: runnerUp?.base ?? null,
      criteria: best.criteria,
      residuals: [
        ...residuals,
        `best candidate does not clear the runner-up by the required ${MIN_MARGIN} margin`,
      ],
      evidence,
      unexplainedTargets: unexplained,
    };
  }

  return {
    member: input.id,
    verdict: "resolved",
    base: best.base,
    score: best.score,
    margin,
    runnerUp: runnerUp?.base ?? null,
    criteria: best.criteria,
    residuals,
    evidence,
    unexplainedTargets: unexplained,
  };
}
