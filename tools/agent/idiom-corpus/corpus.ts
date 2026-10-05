/**
 * corpus.ts — target assembly in, matched C out.
 *
 * The reframe this whole module rests on: the thing a decompiler has on day one
 * is the *target's assembly*, and the thing it lacks is the C. So the query is
 * assembly and the answer is a source span — not "find similar C", which
 * requires already having the answer.
 *
 * Origin: two of the four `ovl_10` functions the overnight loop parked were
 * closed by an idiom that was already proven in the tree. `ovl_10_func_800B9D24`
 * — matched by the same loop three hours earlier, in the same directory — walks
 * its array as `D_800BB99C[s0 + 1]`. Nothing could retrieve it.
 *
 * **No database and no vectors.** At this project's scale — 400-odd matched
 * functions, ~16,000 instructions, ~20,000 indexed regions — an inverted index
 * over IDF-weighted n-grams with an alignment re-rank beats approximate nearest
 * neighbours on every axis that matters: exact, explainable, nothing to go
 * stale, and it builds from the token sequences in well under a second. A
 * vector store becomes interesting when the corpus spans several games and the
 * query is a *mechanism* rather than a shape; it is never the output. The tool
 * reports the alignment it proved, never a cosine, because a similarity score
 * is not a finding and an alignment is one a reader can check.
 *
 * **What is excluded.** A function whose C hands work to the assembler teaches
 * nothing about C: an `INCLUDE_ASM` stub, embedded assembly, hard-register
 * pinning. Indexing them would teach the search that register pinning is a
 * normal answer, which is the belief the clean-source policy exists to prevent.
 * Per-file flag overrides are *kept*, with their own fingerprint: their C is
 * clean and idiomatic, only the build differs, and they are the only in-project
 * evidence about what a different flag column does.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { loadContainers, containerTargetPath } from "../../lib/container.js";
import { requireFunctionLocation, withSymbolMetadata } from "../../lib/symbolIndex.js";
import { digest, snapshot, readCache, writeCache } from "../../lib/contentCache.js";
import { loadCallGraph } from "../../../.pi/extensions/psx-decomp/autonomous/call-graph.ts";
import type { MirInsn, MirProgram } from "../pipeline-reversal/types.js";
import { align, ngrams } from "./align.js";
import { tokensAt, type Tier } from "./normalize.js";
import { compatibility, fingerprintOf, type ToolchainFingerprint } from "./fingerprint.js";

/** Why a function is not in the corpus. Reported, never silent. */
export type Exclusion =
  | "include-asm"
  | "embedded-asm"
  | "register-asm"
  | "not-matched"
  | "no-source"
  | "unliftable";

export interface Region {
  functionName: string;
  /** `block`, `loop` or `window` — idioms do not respect block boundaries. */
  kind: "block" | "loop" | "window";
  /** Block index for a block region; the header's block for a loop. */
  block: number;
  /** Instruction indices within the function's pre-dbr program. */
  from: number;
  to: number;
  vram?: number;
  tokens: string[];
  fingerprint: string;
}

export interface Corpus {
  fingerprints: Record<string, ToolchainFingerprint>;
  regions: Region[];
  /** Functions considered and why each was left out. */
  excluded: Array<{ functionName: string; reason: Exclusion }>;
  /** Functions whose regions are in the index. */
  included: string[];
  tier: Tier;
}

/* --- what may be indexed ------------------------------------------------- */

/**
 * Constructs whose presence means the C is not teaching a C idiom.
 *
 * Detected from the source text's own tokens rather than from the policy
 * allowlist: the allowlist records which functions are *permitted* to use them,
 * and permission is not the question here. The question is whether the words in
 * the object came from the compiler.
 */
const ASSEMBLY_MARKERS: Array<{ pattern: RegExp; reason: Exclusion }> = [
  { pattern: /\bINCLUDE_ASM\s*\(/, reason: "include-asm" },
  /* Register pinning is checked before embedded assembly, because it is
     written with the same `__asm__` keyword and is a different construct with a
     different reason for being excluded. Ordered the other way, every pinned
     declaration is reported as embedded assembly and the counts are wrong. */
  { pattern: /\bregister\b[^;=]*\b__asm__\s*\(/, reason: "register-asm" },
  { pattern: /\b__asm__\s*(?:__volatile__|volatile)?\s*\(/, reason: "embedded-asm" },
  { pattern: /(?:^|[^\w$])asm\s*(?:volatile)?\s*\(/, reason: "embedded-asm" },
];

export function excludedReason(sourceText: string): Exclusion | undefined {
  for (const marker of ASSEMBLY_MARKERS) {
    if (marker.pattern.test(sourceText)) return marker.reason;
  }
  return undefined;
}

/* --- regions ------------------------------------------------------------- */

/** Sliding-window sizes, so an idiom that straddles a block boundary is found. */
const WINDOWS = [8, 16];
const WINDOW_STRIDE = 4;
const MIN_REGION = 4;

export function regionsOf(functionName: string, program: MirProgram, tier: Tier, fingerprint: string): Region[] {
  const regions: Region[] = [];
  const insns = program.insns;
  const push = (kind: Region["kind"], block: number, from: number, to: number) => {
    const run = insns.slice(from, to);
    if (run.length < MIN_REGION) return;
    const tokens = tokensAt(run, tier);
    const region: Region = { functionName, kind, block, from, to, tokens, fingerprint };
    const vram = run[0]?.vram;
    if (vram !== undefined) region.vram = vram;
    regions.push(region);
  };

  /* Blocks. */
  const blocks = new Map<number, number[]>();
  insns.forEach((insn, index) => {
    blocks.set(insn.block, [...(blocks.get(insn.block) ?? []), index]);
  });
  for (const [block, indices] of blocks) {
    push("block", block, indices[0]!, indices[indices.length - 1]! + 1);
  }

  /* Natural loops: a back-edge's target through the branch that closes it.
     The preheader is included, because where an invariant address lands is
     half of what distinguishes two spellings of one loop. */
  for (const loop of naturalLoops(insns)) {
    push("loop", insns[loop.from]?.block ?? -1, loop.from, loop.to);
  }

  /* Windows. */
  for (const size of WINDOWS) {
    for (let start = 0; start + size <= insns.length; start += WINDOW_STRIDE) {
      push("window", insns[start]?.block ?? -1, start, start + size);
    }
  }
  return regions;
}

interface Loop {
  from: number;
  to: number;
}

/**
 * Back-edge loops, with two instructions of preheader.
 *
 * A branch whose resolved target sits earlier in the stream closes a loop. The
 * preheader is where GCC's loop pass puts an invariant address, so a couple of
 * instructions before the header are part of the idiom rather than context.
 */
function naturalLoops(insns: readonly MirInsn[]): Loop[] {
  const loops: Loop[] = [];
  insns.forEach((insn, index) => {
    const target = insn.branchTargetIndex;
    if (target === undefined || target >= index) return;
    loops.push({ from: Math.max(0, target - 2), to: index + 1 });
  });
  return loops;
}

/* --- the index ----------------------------------------------------------- */

export interface SearchHit {
  region: Region;
  /** Sum of the IDF weights of the n-grams the query shares with this region. */
  score: number;
  /** The proof: how many shapes align, in order. */
  common: number;
  /** `common / region length` — how much of the *record* the query covers. */
  ratio: number;
  /** `common / query length` — how much of the *query* the record explains. */
  queryRatio: number;
  /** What the fingerprint distance permits this hit to claim. */
  claim: string;
  distance: string;
  provenAxes: string[];
}

export class IdiomIndex {
  private readonly postings = new Map<string, number[]>();
  private readonly idf = new Map<string, number>();

  constructor(private readonly corpus: Corpus, private readonly n = 3) {
    const documentFrequency = new Map<string, number>();
    corpus.regions.forEach((region, index) => {
      for (const gram of new Set(ngrams(region.tokens, this.n))) {
        this.postings.set(gram, [...(this.postings.get(gram) ?? []), index]);
        documentFrequency.set(gram, (documentFrequency.get(gram) ?? 0) + 1);
      }
    });
    /* Inverse document frequency. Without it every query returns "your function
       has a prologue": the frame stores, the `jal`+`addiu <a>,<hi>` pair and the
       epilogue loads appear in nearly every region and carry no information. */
    const total = Math.max(1, corpus.regions.length);
    for (const [gram, frequency] of documentFrequency) {
      this.idf.set(gram, Math.log(total / frequency));
    }
  }

  get size(): number {
    return this.corpus.regions.length;
  }

  /**
   * Regions whose shapes look like this query, best first.
   *
   * Two stages. The inverted index ranks by shared rare n-grams, which is fast
   * and approximate. The alignment then re-ranks the top candidates and
   * produces the number the tool actually reports — the one a reader can check
   * against the two listings.
   */
  search(
    queryTokens: string[],
    options: { excludeFunction?: string; limit?: number; candidates?: number; queryFingerprint?: ToolchainFingerprint } = {},
  ): SearchHit[] {
    const limit = options.limit ?? 5;
    const candidateCount = options.candidates ?? Math.max(50, limit * 10);

    const scores = new Map<number, number>();
    for (const gram of new Set(ngrams(queryTokens, this.n))) {
      const posting = this.postings.get(gram);
      if (!posting) continue;
      const weight = this.idf.get(gram) ?? 0;
      for (const index of posting) scores.set(index, (scores.get(index) ?? 0) + weight);
    }

    const queryFingerprint = options.queryFingerprint;
    return [...scores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, candidateCount)
      .map(([index, score]) => ({ region: this.corpus.regions[index]!, score }))
      .filter((item) => item.region.functionName !== options.excludeFunction)
      .map((item) => {
        const alignment = align(queryTokens, item.region.tokens);
        const hitFingerprint = this.corpus.fingerprints[item.region.fingerprint];
        const compat = queryFingerprint && hitFingerprint
          ? compatibility(queryFingerprint, hitFingerprint)
          : undefined;
        return {
          region: item.region,
          score: item.score,
          common: alignment.common,
          /* Two ratios, because one number cannot answer both questions. A
             whole-function query against a seven-instruction loop covers 6% of
             the query and 100% of the record, and it is the record that is the
             finding. Reporting only the first reads as a bad match. */
          ratio: alignment.common / Math.max(1, item.region.tokens.length),
          queryRatio: alignment.common / Math.max(1, queryTokens.length),
          claim: compat?.claim ?? "toolchain fingerprint unknown — treat the source idiom as a hypothesis.",
          distance: compat?.distance ?? "unknown",
          provenAxes: compat?.provenAxes ?? [],
        };
      })
      /* Rank by what was proved, not by what was retrieved. */
      .sort((left, right) => right.common - left.common || right.ratio - left.ratio || right.score - left.score)
      .slice(0, limit);
  }
}

/* --- building ------------------------------------------------------------ */

export interface BuildOptions {
  tier?: Tier;
  /** Skip these functions entirely — the one being worked, typically. */
  exclude?: string[];
  /** Report progress; building compiles nothing but does lift every function. */
  onProgress?: (done: number, total: number, functionName: string) => void;
}

/** Every function whose source is clean, matched C, with where it lives. */
export function corpusCandidates(): Array<{ functionName: string; sourcePath: string }> {
  const graph = loadCallGraph(ROOT);
  const out: Array<{ functionName: string; sourcePath: string }> = [];
  const containers = loadContainers();
  for (const entry of graph.functions) {
    if (entry.dead || entry.handwritten === "asm") continue;
    const relative = entry.source ?? `src/${entry.name}.c`;
    let path = join(ROOT, relative);
    if (!existsSync(path)) {
      const found = containers
        .map((container) => join(ROOT, container.paths.srcDir, `${entry.name}.c`))
        .find((candidate) => existsSync(candidate));
      if (!found) continue;
      path = found;
    }
    out.push({ functionName: entry.name, sourcePath: path });
  }
  return out;
}

/**
 * Build the index over every clean-C matched function in this project.
 *
 * The target side is used, never the candidate side: the corpus records what
 * the *original* code looks like next to the C that reproduces it, so a query
 * made from a target's assembly is the same kind of thing as the records.
 */
/**
 * The corpus, from cache when the cache still describes the tree.
 *
 * Lifting 358 functions takes about six seconds — nothing once per session, too
 * much on every triage run. Freshness is decided by the provenance layer rather
 * than by a timestamp: mtime answers "which ran last", never "which describes
 * this tree", and a cache that answers the first question while being asked the
 * second is the exact failure this repository has been bitten by before.
 *
 * Original regions have independent per-function identities. Source eligibility
 * and fingerprints are refreshed on every request; C edits do not relift original
 * bytes. Original/configuration/lifter edits invalidate the affected entries.
 */
export function loadCorpus(
  lift: (functionName: string) => MirProgram | undefined,
  options: BuildOptions = {},
): Corpus {
  return withSymbolMetadata(() => {
    const tier = options.tier ?? 0;
    const skip = new Set(options.exclude ?? []);
    const implementation = digest(JSON.stringify(snapshot(ROOT, ["tools/agent/idiom-corpus", "tools/agent/idiomSearch.ts",
      "tools/agent/pipeline-reversal", "tools/agent/webAnalysis.ts", "tools/lib", "tools/agent/decompToolchain.ts", "package-lock.json"],
      (p) => !p.endsWith(".test.ts"))));
    const identities = new Map(loadContainers().map((c) => [c.id, digest(JSON.stringify(snapshot(ROOT, [
      containerTargetPath(c), c.paths.splat, c.paths.symbolAddrs, c.paths.undefinedFuncs, c.paths.undefinedSyms,
      c.paths.asmDir, c.paths.ldScript, "build/engine_syms.txt", "build/dep_syms.txt", "build/lib_bss_syms.txt",
    ], (p) => p.endsWith(".s"))))]));
    const corpus: Corpus = { tier, fingerprints: {}, regions: [], included: [], excluded: [] };
    let hits = 0, misses = 0;
    const candidates = corpusCandidates();
    candidates.forEach((candidate, index) => {
      options.onProgress?.(index, candidates.length, candidate.functionName);
      if (skip.has(candidate.functionName)) return;
      /* Eligibility is cheap and always current. A C edit never invalidates the
         original-code lift, and an excluded query never poisons other queries. */
      const reason = excludedReason(readFileSync(candidate.sourcePath, "utf8"));
      if (reason) { corpus.excluded.push({ functionName: candidate.functionName, reason }); return; }
      const location = requireFunctionLocation(candidate.functionName);
      const key = digest(JSON.stringify([tier, implementation, identities.get(location.container.id), location.span]));
      const path = join(ROOT, "build/idiomCorpus/regions", location.container.id, `tier${tier}`, `${candidate.functionName}.json`);
      let regions = readCache<Region[]>(path, key);
      if (regions) hits++;
      else {
        misses++;
        const program = lift(candidate.functionName);
        if (!program) { corpus.excluded.push({ functionName: candidate.functionName, reason: "unliftable" }); return; }
        regions = regionsOf(candidate.functionName, program, tier, "");
        writeCache(path, key, regions);
      }
      const fingerprint = fingerprintOf(candidate.functionName);
      corpus.fingerprints[fingerprint.id] = fingerprint;
      corpus.regions.push(...regions.map((r) => ({ ...r, fingerprint: fingerprint.id })));
      corpus.included.push(candidate.functionName);
    });
    console.error(`  idiom corpus tier ${tier}: ${hits} original-region cache hits, ${misses} misses (absent, corrupt or changed original/lifting inputs)`);
    return corpus;
  });
}

export function buildCorpus(
  lift: (functionName: string) => MirProgram | undefined,
  options: BuildOptions = {},
): Corpus {
  const tier = options.tier ?? 0;
  const skip = new Set(options.exclude ?? []);
  const candidates = corpusCandidates().filter((candidate) => !skip.has(candidate.functionName));

  const fingerprints: Record<string, ToolchainFingerprint> = {};
  const regions: Region[] = [];
  const excluded: Array<{ functionName: string; reason: Exclusion }> = [];
  const included: string[] = [];

  candidates.forEach((candidate, index) => {
    options.onProgress?.(index, candidates.length, candidate.functionName);
    const text = readFileSync(candidate.sourcePath, "utf8");
    const reason = excludedReason(text);
    if (reason) {
      excluded.push({ functionName: candidate.functionName, reason });
      return;
    }
    const program = lift(candidate.functionName);
    if (!program) {
      excluded.push({ functionName: candidate.functionName, reason: "unliftable" });
      return;
    }
    const fingerprint = fingerprintOf(candidate.functionName);
    fingerprints[fingerprint.id] = fingerprint;
    regions.push(...regionsOf(candidate.functionName, program, tier, fingerprint.id));
    included.push(candidate.functionName);
  });

  return { fingerprints, regions, excluded, included, tier };
}
