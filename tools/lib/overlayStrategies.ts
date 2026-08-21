/**
 * overlayStrategies.ts — pluggable ways to find the code inside a raw member.
 *
 * An overlay member has no header, so every derivation of where its code sits
 * rests on an assumption about how it was built. Those assumptions are not
 * equally general, and the ones that buy the most are the least portable — so
 * each is a named strategy that declares which toolchain profile it holds for,
 * and the registry runs only the ones that apply to the profile actually
 * detected (tools/lib/toolchainProfile.ts).
 *
 * Two strategies today:
 *
 *   `psyq-section-order` assumes PSYLINK's `.rodata`/`.text`/`.data` order and
 *   therefore exactly one code region, bounded below by the member's leading
 *   pointer table and above by its last `jr ra`. Strong, and only sound for a
 *   PSY-Q link.
 *
 *   `return-clustering` assumes nothing about section order. It groups returns
 *   into clusters separated by more than a function's worth of bytes and treats
 *   each cluster as a code region. Weaker on its own, but it holds for any
 *   MIPS image and it is the one that can *disprove* the single-region
 *   assumption the first strategy makes.
 *
 * When several strategies apply, all of them run and their answers are
 * compared. Agreement is reported as corroboration; disagreement is reported as
 * disagreement, never resolved by preferring the stronger strategy.
 */

import { isDecodableInstruction, isJrRa } from "./mips.js";
import {
  deriveOverlayLayout,
  functionEntryOffsets,
  headPointerRunEnd,
  type OverlayLayout,
} from "./overlayLayout.js";
import { collectSelfReferences, type BaseSolverInput } from "./overlayBase.js";
import { profileMatches, type ToolchainProfile } from "./toolchainProfile.js";

export interface CodeSpan {
  start: number;
  end: number;
}

export interface StrategyResult {
  strategy: string;
  /** Code regions the strategy found, in file order. Empty means "no code here". */
  spans: CodeSpan[];
  evidence: string[];
}

export interface LayoutStrategy {
  id: string;
  /** Toolchain profile ids this holds for; `*` means any. */
  appliesTo: string[];
  rationale: string;
  run(input: BaseSolverInput, base?: number): StrategyResult;
}

/**
 * Returns cluster into code regions.
 *
 * Two returns belonging to the same body of code are at most one function
 * apart. A gap far larger than that is a section boundary, not a long function
 * — so the bound is derived from the member's own return spacing rather than
 * set as a constant, and stated in the evidence.
 */
function clusterReturns(bytes: Buffer): { clusters: CodeSpan[]; gapBound: number; returns: number[] } {
  const words = Math.floor(bytes.length / 4);
  const returns: number[] = [];
  for (let i = 0; i < words; i++) if (isJrRa(bytes.readUInt32LE(i * 4))) returns.push(i * 4);
  if (returns.length === 0) return { clusters: [], gapBound: 0, returns };

  const gaps = returns.slice(1).map((offset, i) => offset - returns[i]!).sort((a, b) => a - b);
  const median = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)]! : 0;
  /* Eight times the median spacing: comfortably longer than any single function
     in a body whose typical function is one median apart, and far shorter than
     a data section. With too few returns to have a median, fall back to the
     span itself, which yields one cluster. */
  const gapBound = Math.max(median * 8, 256);

  const clusters: CodeSpan[] = [];
  let start = returns[0]!;
  let previous = returns[0]!;
  for (const offset of returns.slice(1)) {
    if (offset - previous > gapBound) {
      clusters.push({ start, end: previous + 8 });
      start = offset;
    }
    previous = offset;
  }
  clusters.push({ start, end: previous + 8 });
  return { clusters, gapBound, returns };
}

/**
 * Join spans the same gap bound says belong together.
 *
 * Opening a cluster back to its first entry routinely walks it into the tail of
 * the previous one, so consecutive clusters come out abutting or a couple of
 * instructions apart. Merging on the bound that split them keeps the strategy
 * able to report a genuinely separate code region — those are separated by a
 * data section, not by eight bytes — without fragmenting one `.text`.
 */
function mergeSpans(spans: readonly CodeSpan[], gapBound: number): CodeSpan[] {
  const merged: CodeSpan[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && span.start - last.end <= gapBound) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/** Pull a cluster's lower edge back to the first function entry that opens it. */
function openCluster(bytes: Buffer, cluster: CodeSpan, entries: readonly number[], floor: number): CodeSpan {
  const opening = entries.filter((offset) => offset <= cluster.start && offset >= floor).pop();
  if (opening !== undefined) return { start: opening, end: cluster.end };
  /* No entry rule sees a leaf first function with no caller inside the member;
     walk back while the words still decode. */
  let cursor = cluster.start;
  while (cursor - 4 >= floor && isDecodableInstruction(bytes.readUInt32LE(cursor - 4))) cursor -= 4;
  return { start: cursor, end: cluster.end };
}

export const RETURN_CLUSTERING: LayoutStrategy = {
  id: "return-clustering",
  appliesTo: ["*"],
  rationale:
    "returns belonging to one body of code are at most a function apart, so a much larger gap is a section boundary",
  run(input, base) {
    const bytes = input.bytes;
    const { clusters, gapBound, returns } = clusterReturns(bytes);
    if (clusters.length === 0) {
      return { strategy: this.id, spans: [], evidence: ["no jr ra anywhere: the member holds no function"] };
    }
    const refs = collectSelfReferences(input);
    const callOffsets = base === undefined ? [] : refs.calls.map((target) => target - base);
    const entries = functionEntryOffsets(bytes, callOffsets);
    const floor = headPointerRunEnd(bytes);
    const opened = clusters.map((cluster) => openCluster(bytes, cluster, entries, floor));
    const spans = mergeSpans(opened, gapBound);
    return {
      strategy: this.id,
      spans,
      evidence: [
        `${returns.length} returns, median spacing ${Math.round(
          returns.length > 1 ? (returns[returns.length - 1]! - returns[0]!) / (returns.length - 1) : 0
        )} bytes, cluster gap bound ${gapBound} bytes`,
        `${clusters.length} return cluster(s) merged into ${spans.length} code region(s)`,
      ],
    };
  },
};

export const PSYQ_SECTION_ORDER: LayoutStrategy = {
  id: "psyq-section-order",
  appliesTo: ["psyq"],
  rationale:
    "PSYLINK emits .rodata, then .text, then .data, so a member has exactly one code region bounded by its leading pointer table and its last return",
  run(input, base) {
    const layout = deriveOverlayLayout(input, base);
    const spans = layout.textStart < layout.dataStart ? [{ start: layout.textStart, end: layout.dataStart }] : [];
    return { strategy: this.id, spans, evidence: [...layout.evidence, ...layout.residuals.map((r) => `residual: ${r}`)] };
  },
};

export const LAYOUT_STRATEGIES: LayoutStrategy[] = [PSYQ_SECTION_ORDER, RETURN_CLUSTERING];

export function selectLayoutStrategies(
  profile: ToolchainProfile,
  registry: readonly LayoutStrategy[] = LAYOUT_STRATEGIES
): LayoutStrategy[] {
  return registry.filter((strategy) => profileMatches(profile, strategy.appliesTo));
}

export interface LayoutConsensus {
  /** The spans the run settled on, from the most specific applicable strategy. */
  spans: CodeSpan[];
  /** The strategy whose answer was adopted. */
  adopted: string;
  results: StrategyResult[];
  /** True when every applicable strategy found the same regions. */
  agree: boolean;
  evidence: string[];
}

/** How far two spans may differ and still be called the same region. */
const AGREEMENT_SLACK = 16;

function sameSpans(a: readonly CodeSpan[], b: readonly CodeSpan[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (span, i) =>
      Math.abs(span.start - b[i]!.start) <= AGREEMENT_SLACK && Math.abs(span.end - b[i]!.end) <= AGREEMENT_SLACK
  );
}

/**
 * Run every applicable strategy and compare.
 *
 * The most specific applicable strategy's answer is adopted — it is the one
 * with the most information behind it — but disagreement is reported rather
 * than hidden, because a generic strategy that finds two code regions where a
 * toolchain-specific one assumed a single contiguous `.text` has found a real
 * counterexample to that assumption.
 */
export function deriveLayoutByStrategy(
  input: BaseSolverInput,
  profile: ToolchainProfile,
  base?: number,
  registry: readonly LayoutStrategy[] = LAYOUT_STRATEGIES
): LayoutConsensus {
  const applicable = selectLayoutStrategies(profile, registry);
  const results = applicable.map((strategy) => strategy.run(input, base));
  const evidence: string[] = [
    `toolchain profile ${profile.id} (${profile.verdict}) selects ${applicable.length} of ${registry.length} strategies: ${applicable.map((s) => s.id).join(", ") || "none"}`,
  ];

  if (results.length === 0) {
    return { spans: [], adopted: "none", results, agree: false, evidence: [...evidence, "no strategy applies"] };
  }

  const adopted = results[0]!;
  const agree = results.every((result) => sameSpans(result.spans, adopted.spans));
  for (const result of results) {
    evidence.push(
      `${result.strategy}: ${result.spans.map((s) => `0x${s.start.toString(16)}..0x${s.end.toString(16)}`).join(" ") || "no code region"}`
    );
  }
  if (!agree) {
    evidence.push(
      "DISAGREEMENT: applicable strategies found different code regions; the toolchain-specific assumption may not hold for this member"
    );
  }

  return { spans: adopted.spans, adopted: adopted.strategy, results, agree, evidence };
}

/**
 * The strategy consensus as a section layout.
 *
 * A member with one code region has the `.rodata` / `.text` / `.data` shape the
 * split pipeline needs. More than one region means the single-`.text`
 * assumption does not hold for this member; the layout still describes the
 * outermost extent, and the residual says so rather than the tool pretending
 * the inner boundary does not exist.
 */
export function layoutFromConsensus(consensus: LayoutConsensus, byteLength: number): OverlayLayout {
  const evidence = [...consensus.evidence, `adopted ${consensus.adopted}`];
  if (consensus.spans.length === 0) {
    return {
      rodataStart: 0,
      textStart: byteLength,
      dataStart: byteLength,
      fileEnd: byteLength,
      evidence,
      residuals: ["no code region"],
    };
  }
  const first = consensus.spans[0]!;
  const last = consensus.spans[consensus.spans.length - 1]!;
  const residuals: string[] = [];
  if (consensus.spans.length > 1) {
    residuals.push(
      `${consensus.spans.length} code regions, so this member is not one contiguous .text: ` +
        consensus.spans.map((s) => `0x${s.start.toString(16)}..0x${s.end.toString(16)}`).join(" ")
    );
  }
  if (!consensus.agree) residuals.push("applicable strategies disagreed on the code region");
  return {
    rodataStart: 0,
    textStart: first.start,
    dataStart: last.end,
    fileEnd: byteLength,
    evidence,
    residuals,
  };
}
