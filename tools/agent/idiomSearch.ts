#!/usr/bin/env npx tsx
/**
 * idiomSearch.ts — what C produced assembly that looks like this?
 *
 * Query with a *target's* assembly; get back the C of an already-matched
 * function whose original code has the same shapes. That is the question a
 * decompiler actually has: the assembly is what you hold on day one, the C is
 * what you lack, and every other retrieval in this repository runs the other
 * way round.
 *
 * Three query modes fall out of one index:
 *
 *   whole function  the default. The cold-start query, asked before any C
 *                   exists: what does this kind of code look like when this
 *                   author writes it.
 *   --block N       one block. The residual query — the loop is stuck on a
 *                   block, and this is the block another function already got
 *                   right.
 *   self            a function's own closed blocks against its open ones.
 *                   Needs no corpus and is the strongest evidence there is —
 *                   same compiler invocation, same file, same author. It lives
 *                   in `psx_triage` as the self-similarity detector, built on
 *                   the same normalizer, and is named here because it is the
 *                   same question asked at the shortest range.
 *
 * The output is an *alignment*, never a similarity score: "14 of 17 shapes
 * align in order with ovl_10_func_800B9D24 block 12" is a claim a reader can
 * check against the two listings. A cosine is not.
 *
 * Usage:
 *   npx tsx tools/agent/idiomSearch.ts <function>
 *   npx tsx tools/agent/idiomSearch.ts <function> --block 41
 *   npx tsx tools/agent/idiomSearch.ts <function> --tier 1 --limit 8
 *   npx tsx tools/agent/idiomSearch.ts --benchmark
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import { targetWordsOf } from "../lib/functionOracle.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { loadContainers } from "../lib/container.js";
import { liftWords } from "./pipeline-reversal/lift.js";
import { inverseAssembler } from "./pipeline-reversal/inverse-assembler.js";
import { inverseDbr } from "./pipeline-reversal/inverse-dbr.js";
import type { MirProgram } from "./pipeline-reversal/types.js";
import { tokensAt, type Tier } from "./idiom-corpus/normalize.js";
import { loadCorpus, IdiomIndex, type Corpus, type SearchHit } from "./idiom-corpus/corpus.js";
import { fingerprintOf } from "./idiom-corpus/fingerprint.js";

/**
 * The original function's program, at the waypoint the residual is read at:
 * pre-dbr order, delay slots un-filled.
 *
 * Nothing is compiled. The target's own bytes are lifted, the assembler's
 * inserted words are removed, and the delay slots are un-filled — the same
 * chain the reversal runs, minus the candidate side that does not exist for a
 * function nobody has written C for yet.
 */
export function targetProgram(functionName: string): MirProgram | undefined {
  try {
    const container = requireFunctionLocation(functionName).container;
    const words = targetWordsOf(functionName, { container });
    if (words.length === 0) return undefined;
    const machine = liftWords({ functionName, words });
    return inverseDbr(inverseAssembler(machine).program).program;
  } catch {
    return undefined;
  }
}

function sourcePathOf(functionName: string): string | undefined {
  for (const container of loadContainers()) {
    const path = join(ROOT, container.paths.srcDir, `${functionName}.c`);
    if (existsSync(path)) return path;
  }
  return undefined;
}

/* --- rendering ----------------------------------------------------------- */

function renderHit(hit: SearchHit, queryTokens: string[], index: number): string[] {
  const region = hit.region;
  const where = region.vram === undefined ? "" : ` at 0x${region.vram.toString(16).toUpperCase()}`;
  const lines = [
    `${index + 1}. ${region.functionName} ${region.kind} ${region.block}${where}` +
    `  —  ${hit.common} of its ${region.tokens.length} shapes align in order with this query` +
    ` (${(hit.ratio * 100).toFixed(0)}% of the region, ${(hit.queryRatio * 100).toFixed(0)}% of the ${queryTokens.length}-shape query)`,
    `   toolchain: ${hit.distance} — ${hit.claim}`,
  ];
  const source = sourcePathOf(region.functionName);
  if (source) {
    lines.push(`   source: ${source.slice(ROOT.length + 1)}  (region ${region.from}..${region.to} of the target stream)`);
  }
  return lines;
}

/**
 * The C of the top hit, whole.
 *
 * Mapping a region back to the exact lines that produced it needs a line map
 * the build does not emit. Returning the whole matched function and naming the
 * region is the cheap first step and is already the thing the reader wants:
 * they are looking for how this author writes this shape, and the function is
 * short.
 */
function renderSource(hit: SearchHit): string[] {
  const path = sourcePathOf(hit.region.functionName);
  if (!path) return [];
  const text = readFileSync(path, "utf8");
  return [
    "",
    `--- ${path.slice(ROOT.length + 1)} — the C that produced the shapes above ---`,
    text.trimEnd(),
    "--- end ---",
  ];
}

/* --- benchmark ----------------------------------------------------------- */

/**
 * The known answers.
 *
 * Three cases whose right answer was established by hand before any of this
 * existed, plus leave-one-out recall over the whole corpus. If recall on a
 * same-group neighbour is poor the fix is in the normalization, and finding
 * that out costs a run rather than a week.
 */
const KNOWN_CASES: Array<{ query: string; block?: number; expect: string[]; why: string }> = [
  {
    query: "ovl_10_func_800BB264",
    expect: ["ovl_10_func_800BADA4", "ovl_10_func_800B9D24"],
    why: "the grid-display twins; 800BADA4 carries a byte-identical residual signature",
  },
  {
    query: "ovl_10_func_800BADA4",
    expect: ["ovl_10_func_800BB264", "ovl_10_func_800B9D24"],
    why: "the same pair from the other side",
  },
  {
    query: "ovl_10_func_800BA394",
    expect: ["ovl_10_func_800BB264", "ovl_10_func_800BADA4", "ovl_10_func_800B95F0"],
    why: "the parked grid-display member; its answer is in the two that were solved",
  },
];

/**
 * Leave-one-out recall over the whole corpus.
 *
 * The honest measure, and the one that says whether the normalization is right
 * rather than whether three hand-picked cases work. Each function is held out,
 * queried with its own target assembly, and scored on whether the top-k names a
 * *neighbour* — a function from the same suspected translation unit, which is
 * the relation the retrieval is supposed to surface. Sampled, and the sample
 * size is printed, because a sample supports no statement about the domain
 * unless the reader knows it was one.
 */
function leaveOneOut(index: IdiomIndex, tier: Tier, sample: number): void {
  const groups = groupIndex();
  const names = [...new Set([...groups.values()].flat())].filter((name) => groups.has(name));
  const step = Math.max(1, Math.floor(names.length / sample));
  const chosen = names.filter((_, position) => position % step === 0).slice(0, sample);

  let asked = 0;
  let atOne = 0;
  let atThree = 0;
  for (const name of chosen) {
    const neighbours = new Set(groups.get(name) ?? []);
    neighbours.delete(name);
    if (neighbours.size === 0) continue;
    const program = targetProgram(name);
    if (!program) continue;
    const hits = index.search(tokensAt(program.insns, tier), {
      excludeFunction: name,
      limit: 12,
      queryFingerprint: fingerprintOf(name),
    });
    const ranked: string[] = [];
    for (const hit of hits) {
      if (!ranked.includes(hit.region.functionName)) ranked.push(hit.region.functionName);
    }
    asked++;
    if (ranked[0] && neighbours.has(ranked[0])) atOne++;
    if (ranked.slice(0, 3).some((candidate) => neighbours.has(candidate))) atThree++;
  }

  console.log("");
  if (asked === 0) {
    console.log("  leave-one-out: no sampled function has a recorded same-group neighbour to find.");
    return;
  }
  console.log(`  leave-one-out over ${asked} sampled function(s) with a recorded same-group neighbour:`);
  console.log(`    recall@1 ${((atOne / asked) * 100).toFixed(0)}%   recall@3 ${((atThree / asked) * 100).toFixed(0)}%`);
  console.log("    ('a neighbour' = a member of the same group in notes/file-groupings.md)");
}

/** Suspected-translation-unit membership, from the grouping ledger. */
function groupIndex(): Map<string, string[]> {
  const path = join(ROOT, "notes/file-groupings.md");
  const membership = new Map<string, string[]>();
  if (!existsSync(path)) return membership;
  let members: string[] | undefined;
  const groups: string[][] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (/^##\s/.test(line)) {
      if (members && members.length > 1) groups.push(members);
      members = undefined;
      continue;
    }
    if (/^Members\b/i.test(line.trim())) {
      members = [];
      continue;
    }
    if (members === undefined) continue;
    const bullet = line.match(/^-\s+([A-Za-z_]\w*)\b[^(\n]*\((?:m|s|\?)\b/);
    if (bullet) members.push(bullet[1]!);
  }
  if (members && members.length > 1) groups.push(members);
  for (const group of groups) {
    for (const name of group) membership.set(name, group);
  }
  return membership;
}

function runBenchmark(corpus: Corpus, index: IdiomIndex, tier: Tier): number {
  let failures = 0;
  console.log(`benchmark — ${index.size} regions from ${corpus.included.length} functions, tier ${tier}`);
  const byReason = new Map<string, number>();
  for (const item of corpus.excluded) byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
  console.log(`  excluded: ${[...byReason].map(([reason, count]) => `${count} ${reason}`).join(", ") || "none"}`);
  console.log("");
  for (const testCase of KNOWN_CASES) {
    const program = targetProgram(testCase.query);
    if (!program) {
      console.log(`  SKIP ${testCase.query} — could not lift its target`);
      continue;
    }
    const tokens = tokensAt(program.insns, tier);
    const hits = index.search(tokens, {
      excludeFunction: testCase.query,
      limit: 5,
      queryFingerprint: fingerprintOf(testCase.query),
    });
    const names: string[] = [];
    for (const hit of hits) {
      if (!names.includes(hit.region.functionName)) names.push(hit.region.functionName);
    }
    const top3 = names.slice(0, 3);
    const hit = testCase.expect.some((name) => top3.includes(name));
    if (!hit) failures++;
    console.log(`  ${hit ? "PASS" : "FAIL"} ${testCase.query} → ${top3.join(", ") || "(nothing)"}`);
    console.log(`       expected one of ${testCase.expect.join(", ")} — ${testCase.why}`);
  }
  return failures;
}

/* --- main ---------------------------------------------------------------- */

function usage(message?: string): never {
  if (message) console.error(`idiomSearch: ${message}`);
  console.error(
    "Usage: npx tsx tools/agent/idiomSearch.ts <function> [--block <n>] [--tier 0|1|2] [--limit <n>] [--source] [--json]\n" +
      "       npx tsx tools/agent/idiomSearch.ts --benchmark [--tier 0|1|2]",
  );
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("idiomSearch.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const tier = Number(flag("tier") ?? 0) as Tier;
  if (![0, 1, 2].includes(tier)) usage("--tier must be 0, 1 or 2");
  const benchmark = args.includes("--benchmark");
  const positional = args.filter((argument, index) =>
    !argument.startsWith("--") && !args[index - 1]?.startsWith("--"));

  if (!benchmark && positional.length !== 1) usage("name exactly one function");
  const functionName = positional.length === 1 ? normalizeFunctionName(positional[0]!) : undefined;

  const started = Date.now();
  const corpus = loadCorpus(targetProgram, { tier, exclude: functionName ? [functionName] : [] });
  const index = new IdiomIndex(corpus);
  const buildMs = Date.now() - started;

  if (benchmark) {
    const failures = runBenchmark(corpus, index, tier);
    leaveOneOut(index, tier, Number(flag("sample") ?? 40));
    console.log("");
    console.log(`built in ${buildMs} ms`);
    process.exitCode = failures === 0 ? 0 : 1;
  } else {
    const program = targetProgram(functionName!);
    if (!program) usage(`could not lift the target of ${functionName}`);
    const blockArgument = flag("block");
    const insns = blockArgument === undefined
      ? program!.insns
      : program!.insns.filter((insn) => insn.block === Number(blockArgument));
    if (insns.length === 0) usage(`block ${blockArgument} has no instructions`);
    const tokens = tokensAt(insns, tier);
    const hits = index.search(tokens, {
      excludeFunction: functionName!,
      limit: Number(flag("limit") ?? 5),
      queryFingerprint: fingerprintOf(functionName!),
    });

    if (args.includes("--json")) {
      console.log(JSON.stringify({
        function: functionName,
        tier,
        block: blockArgument === undefined ? undefined : Number(blockArgument),
        corpus: { regions: index.size, functions: corpus.included.length, excluded: corpus.excluded, buildMs },
        query: tokens,
        hits,
      }, null, 2));
    } else {
      console.log(
        `idiom search: ${functionName}${blockArgument === undefined ? "" : ` block ${blockArgument}`}` +
        ` — ${tokens.length} shapes, tier ${tier}`,
      );
      const byReason = new Map<string, number>();
      for (const item of corpus.excluded) byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
      console.log(
        `corpus: ${index.size} regions from ${corpus.included.length} clean-C matched functions; ` +
        `excluded ${[...byReason].map(([reason, count]) => `${count} ${reason}`).join(", ") || "none"}; ` +
        `built in ${buildMs} ms`,
      );
      console.log("");
      if (hits.length === 0) {
        console.log("no region in the corpus shares a rare shape run with this query.");
        console.log("That is a finding: this shape has no precedent in the matched set at this tier.");
        console.log("Try --tier 1 (op classes, survives an addressing-macro difference) before concluding it.");
      }
      hits.forEach((hit, position) => {
        for (const line of renderHit(hit, tokens, position)) console.log(line);
      });
      if (args.includes("--source") && hits[0]) {
        for (const line of renderSource(hits[0])) console.log(line);
      }
    }
  }
}
