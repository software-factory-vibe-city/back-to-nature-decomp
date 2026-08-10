#!/usr/bin/env npx tsx
/**
 * Reproducible, mechanism-aware compiler variant laboratory.
 *
 * Every variant must carry a hypothesis. Inputs, compiler artifacts, normalized
 * comparisons, pass traces, flags, hashes, and verdicts are preserved under a
 * deterministic build/fuzz/<function>/<run-id>/ directory.
 */

import { existsSync, readdirSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import {
  CC1_FLAGS,
  ROOT,
  assembleTarget,
  configuredToolchainIdentity,
  disassembleObject,
  loadFlagOverrides,
  normalizeFunctionName,
  resolveSource,
  type DisassembledInstruction,
} from "./decompToolchain.js";
import { analyzeInstructionSets } from "./explainDiff.js";
import { deterministicRunId, hashDirectoryFiles, projectPath, variantLabImplementationHash, writeRunManifest, writeRunSummary } from "./variant-lab/artifacts.js";
import { classifyHypothesis, VERDICT_RANK } from "./variant-lab/classify-hypothesis.js";
import {
  compareNormalized,
  compileVariant,
  normalizeDisassembly,
  writeNormalizedComparison,
  type CompiledVariant,
} from "./variant-lab/compile.js";
import {
  hypothesesFromPaths,
  loadManifest,
  resolveHypotheses,
} from "./variant-lab/manifest.js";
import { comparePassSnapshots } from "./variant-lab/pass-diff.js";
import { generateTransformationVariants } from "./variant-lab/transformations.js";
import { PASS_STAGES } from "./variant-lab/types.js";
import type {
  NormalizedInstruction,
  ResolvedVariantHypothesis,
  VariantHypothesis,
  VariantResult,
  VariantRunManifest,
  VariantRunSummary,
} from "./variant-lab/types.js";

interface CliOptions {
  functionName: string;
  variants: string[];
  manifest?: string;
  transformSpec?: string;
  mechanism?: string;
  expectedPass?: string;
  expectedEffect?: string;
  invariants: string[];
  cc1Only: boolean;
  tracePasses: boolean;
  json: boolean;
  show?: string;
}

interface InternalResult {
  result: VariantResult;
  hypothesis: ResolvedVariantHypothesis;
  compiled?: CompiledVariant;
  fullInstructions?: DisassembledInstruction[];
  normalized: NormalizedInstruction[];
}

function usage(message?: string): never {
  if (message) console.error(`fuzzVariants: ${message}\n`);
  console.error("Usage:");
  console.error("  npx tsx tools/agent/fuzzVariants.ts <func> --manifest <hypotheses.json> [--trace-passes]");
  console.error("  npx tsx tools/agent/fuzzVariants.ts <func> <variant.c> [...] --mechanism <kind> --expected-pass <pass> --expected-effect <text> [--invariant <text>]");
  console.error("  npx tsx tools/agent/fuzzVariants.ts <func> --transform-spec <spec.json> [--trace-passes]");
  console.error("Options: --dir <dir> --cc1-only --trace-passes --show <id> --json");
  process.exit(1);
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usage(`${name} requires a value`);
  return value;
}

function optionValues(args: string[], name: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) usage(`${name} requires a value`);
    result.push(value);
  }
  return result;
}

function parseArgs(args: string[]): CliOptions {
  if (args.length === 0 || args[0].startsWith("--")) usage();
  const valuedFlags = new Set([
    "--manifest", "--transform-spec", "--mechanism", "--expected-pass", "--expected-effect",
    "--invariant", "--show", "--dir",
  ]);
  const booleanFlags = new Set(["--cc1-only", "--trace-passes", "--json"]);
  for (const argument of args.slice(1)) {
    if (argument.startsWith("--") && !valuedFlags.has(argument) && !booleanFlags.has(argument)) {
      usage(`unknown option: ${argument}`);
    }
  }
  const consumed = new Set<number>([0]);
  for (let index = 1; index < args.length; index++) {
    if (valuedFlags.has(args[index])) {
      consumed.add(index);
      consumed.add(index + 1);
      index++;
    } else if (args[index].startsWith("--")) consumed.add(index);
  }
  const positional = args.filter((_arg, index) => !consumed.has(index));
  const directory = optionValue(args, "--dir");
  let variants = positional;
  if (directory) {
    if (variants.length > 0) usage("do not combine positional variants with --dir");
    const absolute = isAbsolute(directory) ? directory : join(ROOT, directory);
    if (!existsSync(absolute)) usage(`variant directory not found: ${directory}`);
    variants = readdirSync(absolute).filter((file) => file.endsWith(".c")).sort().map((file) => join(absolute, file));
  }
  const manifest = optionValue(args, "--manifest");
  const transformSpec = optionValue(args, "--transform-spec");
  const inputModes = Number(Boolean(manifest)) + Number(Boolean(transformSpec)) + Number(variants.length > 0);
  if (inputModes !== 1) usage("choose exactly one of --manifest, --transform-spec, or positional/--dir variants");
  return {
    functionName: normalizeFunctionName(args[0]),
    variants,
    manifest,
    transformSpec,
    mechanism: optionValue(args, "--mechanism"),
    expectedPass: optionValue(args, "--expected-pass"),
    expectedEffect: optionValue(args, "--expected-effect"),
    invariants: optionValues(args, "--invariant"),
    cc1Only: args.includes("--cc1-only"),
    tracePasses: args.includes("--trace-passes"),
    json: args.includes("--json"),
    show: optionValue(args, "--show"),
  };
}

function inputHypotheses(options: CliOptions): VariantHypothesis[] {
  if (options.manifest) return loadManifest(options.manifest, options.functionName).variants;
  if (options.transformSpec) return generateTransformationVariants(options.transformSpec, options.functionName);
  return hypothesesFromPaths(options.variants, {
    mechanism: options.mechanism,
    expectedPass: options.expectedPass,
    expectedEffect: options.expectedEffect,
    invariants: options.invariants,
  });
}

function withBaseline(functionName: string, hypotheses: VariantHypothesis[]): VariantHypothesis[] {
  if (hypotheses.some((hypothesis) => hypothesis.baseline)) return hypotheses;
  let id = "baseline";
  const ids = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  while (ids.has(id)) id = `_${id}`;
  return [{
    id,
    sourcePath: projectPath(resolveSource(functionName)),
    mechanism: "custom",
    expectedPass: "rtl",
    expectedEffect: "reference compiler behavior",
    invariants: ["reference source is compiled with the same target flags"],
    baseline: true,
  }, ...hypotheses];
}

function firstTargetDivergence(report: ReturnType<typeof analyzeInstructionSets>): string | undefined {
  const first = report.differences[0];
  return first ? `[${first.index}] ${first.target} vs ${first.compiled} (${first.kind})` : undefined;
}

function compileAll(options: {
  functionName: string;
  variants: ResolvedVariantHypothesis[];
  runRoot: string;
  cc1Only: boolean;
  tracePasses: boolean;
  targetFull: DisassembledInstruction[];
  targetNormalized: NormalizedInstruction[];
}): InternalResult[] {
  const results: InternalResult[] = [];
  for (const hypothesis of options.variants) {
    const outputDirectory = join(options.runRoot, "variants", hypothesis.id);
    const base: VariantResult = {
      id: hypothesis.id,
      source: projectPath(hypothesis.absoluteSourcePath),
      sourceHash: hypothesis.sourceHash,
      mechanism: hypothesis.mechanism,
      expectedPass: hypothesis.expectedPass,
      expectedEffect: hypothesis.expectedEffect,
      invariants: hypothesis.invariants,
      baseline: Boolean(hypothesis.baseline),
      status: "mismatch",
      verdict: "inconclusive",
      verdictReason: "not yet classified",
      promotionEligible: false,
      artifacts: projectPath(outputDirectory),
      artifactHashes: {},
      flags: [],
    };
    const internal: InternalResult = { result: base, hypothesis, normalized: [] };
    results.push(internal);
    try {
      const compiled = compileVariant({
        functionName: options.functionName,
        hypothesis,
        outputDirectory,
        cc1Only: options.cc1Only,
        tracePasses: options.tracePasses,
      });
      internal.compiled = compiled;
      base.flags = compiled.artifacts.cc1Flags;
      if (options.cc1Only) {
        internal.normalized = compiled.normalizedAssembly;
        const comparison = compareNormalized(options.targetNormalized, internal.normalized);
        base.exact = comparison.exact;
        base.total = comparison.total;
        base.category = comparison.category;
        base.firstDivergence = comparison.firstDivergence;
        base.status = comparison.exact === comparison.total ? "exact" : "mismatch";
      } else {
        const full = disassembleObject(compiled.artifacts.object!);
        internal.fullInstructions = full;
        internal.normalized = normalizeDisassembly(full);
        const report = analyzeInstructionSets(options.targetFull, full);
        base.exact = report.exactMatches;
        base.total = report.targetCount;
        base.category = report.category;
        base.firstDivergence = firstTargetDivergence(report);
        base.status = report.category === "exact" ? "exact" : "mismatch";
      }
      writeNormalizedComparison(outputDirectory, options.targetNormalized, internal.normalized);
    } catch (error: any) {
      base.status = "compile-error";
      base.error = String(error?.message || error).split("\n")[0];
    }
    base.artifactHashes = hashDirectoryFiles(outputDirectory);
  }
  return results;
}

function classifyAll(
  results: InternalResult[],
  baselineId: string,
  tracePasses: boolean,
  cc1Only: boolean,
): void {
  const baseline = results.find((entry) => entry.hypothesis.id === baselineId);
  for (const entry of results) {
    if (tracePasses && baseline?.compiled?.passes && entry.compiled?.passes && entry.hypothesis.id !== baselineId) {
      entry.result.passComparison = comparePassSnapshots(baseline.compiled.passes, entry.compiled.passes);
      if (entry.result.passComparison.equivalent) {
        entry.result.category = "equivalent-to-baseline";
        entry.result.firstDivergence = "equivalent to baseline through .dbr";
      }
    }
    const classification = classifyHypothesis({
      hypothesis: entry.hypothesis,
      status: entry.result.status,
      passComparison: entry.result.passComparison,
      tracePasses,
      cc1Only,
      baseline: entry.hypothesis.id === baselineId,
    });
    entry.result.verdict = classification.verdict;
    entry.result.verdictReason = classification.reason;
    entry.result.promotionEligible = classification.promotionEligible;
  }
}

function rankResults(results: InternalResult[]): InternalResult[] {
  return [...results].sort((left, right) =>
    Number(right.result.baseline) - Number(left.result.baseline) ||
    VERDICT_RANK[left.result.verdict] - VERDICT_RANK[right.result.verdict] ||
    Number(right.result.status === "exact") - Number(left.result.status === "exact") ||
    (right.result.exact ?? -1) - (left.result.exact ?? -1) ||
    left.result.id.localeCompare(right.result.id),
  );
}

/**
 * Group variants that compiled to identical code, and — when passes were
 * traced — name the earliest stage at which the group's dumps already agreed.
 *
 * A sweep over "different" source spellings is worth one data point per group,
 * not one per file: two shapes that reach the same RTL are the same experiment
 * however different they read. Saying so up front is what stops a session from
 * re-running a null experiment a dozen times in different clothes.
 */
function groupByOutcome(results: InternalResult[]): void {
  const groups = new Map<string, InternalResult[]>();
  for (const entry of results) {
    if (entry.result.status === "compile-error") continue;
    const key = entry.normalized.map((instruction) => instruction.canonical).join("\n");
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  /* Label by descending size so group A is the one to stop repeating. */
  const ordered = [...groups.values()].sort((left, right) =>
    right.length - left.length || left[0]!.result.id.localeCompare(right[0]!.result.id));

  ordered.forEach((members, index) => {
    const label = String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index / 26)) : "");
    for (const member of members) member.result.outcomeGroup = label;
    if (members.length < 2) return;
    const representative = members[0]!;
    for (const member of members) {
      if (member === representative || !member.compiled?.passes || !representative.compiled?.passes) continue;
      for (const stage of PASS_STAGES) {
        const mine = member.compiled.passes.get(stage);
        const theirs = representative.compiled.passes.get(stage);
        if (!mine || !theirs) continue;
        if (mine.hash === theirs.hash) {
          member.result.convergedAt = stage;
          break;
        }
      }
    }
  });
}

function renderOutcomeGroups(ranked: InternalResult[]): string[] {
  const groups = new Map<string, InternalResult[]>();
  for (const entry of ranked) {
    const label = entry.result.outcomeGroup;
    if (!label) continue;
    const bucket = groups.get(label);
    if (bucket) bucket.push(entry);
    else groups.set(label, [entry]);
  }
  const compiled = ranked.filter((entry) => entry.result.outcomeGroup).length;
  if (groups.size === 0 || groups.size === compiled) return [];

  const lines = ["", `Distinct outcomes: ${groups.size} from ${compiled} compiled variant(s).`];
  for (const [label, members] of [...groups.entries()].sort()) {
    const first = members[0]!.result;
    const score = first.exact === undefined ? "-" : `${first.exact}/${first.total}`;
    const converged = members.map((member) => member.result.convergedAt).find(Boolean);
    const where = members.length > 1
      ? converged ? `, identical from .${converged} onward` : ", pass dumps not traced"
      : "";
    lines.push(`  ${label} ${score.padEnd(8)} ${members.map((member) => member.result.id).join(", ")}${where}`);
  }
  lines.push("  Variants inside one group are the same experiment. To learn anything");
  lines.push("  new, move an axis that separates the groups — or a different axis.");
  return lines;
}

function renderSummary(summary: Omit<VariantRunSummary, "results">, ranked: InternalResult[]): string {
  const lines = [
    `Variant laboratory: ${summary.function}`,
    `run:      ${summary.runId}`,
    `mode:     ${summary.mode}${summary.mode === "cc1-only" ? " (full confirmation required)" : ""}`,
    `trace:    ${summary.tracePasses ? "rtl -> jump -> cse -> combine -> regmove -> sched -> lreg -> greg -> sched2 -> dbr" : "disabled"}`,
    `baseline: ${summary.baselineId}`,
    `artifacts:${summary.artifacts}`,
    "",
    `${"variant".padEnd(24)} ${"verdict".padEnd(20)} ${"mechanism".padEnd(27)} ${"score".padEnd(9)} first mechanism/target divergence`,
  ];
  for (const entry of ranked) {
    const result = entry.result;
    const score = result.exact === undefined ? "-" : `${result.exact}/${result.total}`;
    const pass = result.passComparison?.firstDivergence;
    const passEvidence = pass
      ? [pass.affectedUids.length ? `UID ${pass.affectedUids.join("/")}` : "", pass.affectedPseudos.length ? `pseudo ${pass.affectedPseudos.join("/")}` : ""]
        .filter(Boolean).join(", ")
      : "";
    const divergence = pass
      ? `.${pass.stage}: ${pass.summary}${passEvidence ? ` [${passEvidence}]` : ""}`
      : result.firstDivergence || result.error || result.verdictReason;
    lines.push(`${result.id.padEnd(24)} ${result.verdict.padEnd(20)} ${result.mechanism.padEnd(27)} ${score.padEnd(9)} ${divergence}`);
    if (!result.baseline) {
      lines.push(`  expected .${result.expectedPass}: ${result.expectedEffect}`);
      const later = result.passComparison?.divergentStages.slice(1) || [];
      const consequenceStages = new Set([result.expectedPass.replace(/^\./, ""), "combine", "greg", "sched2"]);
      const consequences = later.filter((difference) => consequenceStages.has(difference.stage));
      for (const consequence of consequences) {
        lines.push(`  consequence .${consequence.stage}: ${consequence.summary}`);
      }
    }
  }
  lines.push(...renderOutcomeGroups(ranked));
  lines.push("", "Verdicts rank predicted mechanism evidence before exact-match count.");
  const promotable = ranked.filter((entry) => entry.result.promotionEligible);
  if (promotable.length > 0) {
    for (const entry of promotable) lines.push(`promotion candidate: ${entry.result.source}`);
    lines.push(`Copy a selected candidate over src/${summary.function}.c, then confirm with diffFunc and make check.`);
  } else if (summary.mode === "cc1-only" && ranked.some((entry) => entry.result.status === "exact")) {
    lines.push("No cc1-only result is promotion-eligible; re-run the same manifest in full mode.");
  } else {
    lines.push("No mechanism-confirmed exact result is promotion-eligible.");
  }
  return lines.join("\n");
}

function showComparison(entry: InternalResult, target: NormalizedInstruction[]): string {
  const lines = [`--- ${entry.result.id}: target vs compiled ---`];
  const count = Math.max(target.length, entry.normalized.length);
  for (let index = 0; index < count; index++) {
    const left = target[index]?.canonical || "";
    const right = entry.normalized[index]?.canonical || "";
    lines.push(`${left === right ? "  " : "* "}${String(index).padStart(3)} ${left.padEnd(42)} ${right}`);
  }
  return lines.join("\n");
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const hypotheses = withBaseline(options.functionName, inputHypotheses(options));
  const variants = resolveHypotheses(hypotheses);
  const baseline = variants.find((variant) => variant.baseline)!;
  const mode = options.cc1Only ? "cc1-only" : "full";
  const toolchain = {
    ...configuredToolchainIdentity(),
    variantLab: { schemaVersion: 1 as const, sha256: variantLabImplementationHash() },
  };
  const compilerFlags = [...CC1_FLAGS, ...(loadFlagOverrides().get(options.functionName) || [])];
  if (options.tracePasses) compilerFlags.push("-da");
  const runId = deterministicRunId({
    functionName: options.functionName,
    mode,
    tracePasses: options.tracePasses,
    variants,
    toolchain,
    compilerFlags,
  });
  const runRoot = join(ROOT, "build/fuzz", options.functionName, runId);
  rmSync(runRoot, { recursive: true, force: true });

  const targetFull = disassembleObject(assembleTarget(options.functionName, runRoot));
  const targetNormalized = normalizeDisassembly(targetFull);
  const manifest: VariantRunManifest = {
    schemaVersion: 1,
    function: options.functionName,
    runId,
    mode,
    tracePasses: options.tracePasses,
    baselineId: baseline.id,
    compilerFlags,
    variants: variants.map((variant) => ({
      id: variant.id,
      sourcePath: projectPath(variant.absoluteSourcePath),
      sourceHash: variant.sourceHash,
      mechanism: variant.mechanism,
      expectedPass: variant.expectedPass,
      expectedEffect: variant.expectedEffect,
      invariants: variant.invariants,
      baseline: Boolean(variant.baseline),
      artifacts: projectPath(join(runRoot, "variants", variant.id)),
    })),
    toolchain,
  };
  writeRunManifest(runRoot, manifest);

  const results = compileAll({
    functionName: options.functionName,
    variants,
    runRoot,
    cc1Only: options.cc1Only,
    tracePasses: options.tracePasses,
    targetFull,
    targetNormalized,
  });
  classifyAll(results, baseline.id, options.tracePasses, options.cc1Only);
  groupByOutcome(results);
  const ranked = rankResults(results);
  const summaryBase = {
    schemaVersion: 1 as const,
    function: options.functionName,
    runId,
    mode,
    tracePasses: options.tracePasses,
    baselineId: baseline.id,
    targetInstructions: targetFull.length,
    artifacts: projectPath(runRoot),
    caveats: [
      "Hypothesis confirmation verifies the predicted first pass, not the free-text expected effect; inspect the preserved pass evidence.",
      "A cc1-only exact result is never promotion-eligible until reproduced in full mode.",
      "Exact target comparison remains the final oracle; verdict ranking is intentionally not percentage hill climbing.",
    ],
  };
  const text = renderSummary(summaryBase, ranked);
  const summary: VariantRunSummary = { ...summaryBase, results: ranked.map((entry) => entry.result) };
  writeRunSummary(runRoot, summary, text);

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(text);
    if (options.show) {
      const shown = results.find((entry) => entry.result.id === options.show);
      console.log(shown ? `\n${showComparison(shown, targetNormalized)}` : `\n--show: no variant named ${options.show}`);
    }
  }
  if (results.every((entry) => entry.result.status === "compile-error")) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`fuzzVariants: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
