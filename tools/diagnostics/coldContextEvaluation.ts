/**
 * coldContextEvaluation.ts — what reconstruction recovers with the recovered
 * game C withheld.
 *
 * Almost every number this project has about automatic reconstruction is a
 * *warm* number, produced in a tree that already holds hundreds of matched
 * functions, their generated headers and their C available as donors. That is
 * the right measurement for "how much work is left here" and the wrong one for
 * "how much can be recovered from a binary" — and only the second generalises,
 * because it is the question a project on its first day is asking.
 *
 * Cold mode withholds exactly the recovered game material: matched-definition
 * signatures, the umbrella header as a compile context, and family donors. The
 * configured project and its toolchain stay — the compiler, the flags, the SDK
 * headers, the container images, the symbol tables — because the plan's scope
 * is reconstruction inside a configured project, not bootstrapping one.
 *
 * Three strata are reported separately, because mixing them hides the thing
 * that matters:
 *
 *   - **warm**: the tree as it is;
 *   - **cold**: recovered game C withheld;
 *   - **family-held-out**: warm, except that the function's own family donors
 *     are withheld. A transfer from a sibling is real progress and is not an
 *     independent recovery, so a table that counted it as one would overstate
 *     what the reconstruction can do on a function with no precedent.
 *
 * The output is a difference, not a percentage. "Fourteen warm, nine cold"
 * says which capabilities depend on recovered context; one blended number says
 * nothing at all.
 *
 * Usage:
 *   npx tsx tools/diagnostics/coldContextEvaluation.ts <fn> [<fn> ...]
 *   npx tsx tools/diagnostics/coldContextEvaluation.ts --set development
 *   npx tsx tools/diagnostics/coldContextEvaluation.ts --sample 30 [--container ovl_11]
 *   Options: --json
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../agent/decompToolchain.js";
import { writeStableJson } from "../agent/provenance.js";
import { loadContainers, requireContainer, type Container } from "../lib/container.js";
import { loadFunctionSpans } from "../lib/symbolIndex.js";
import { reconstructFunction } from "../agent/matching-reconstruction/engine.js";
import { describeContextMode, withContextMode } from "../agent/matching-reconstruction/context-mode.js";
import { buildFamilyIndex, donorsFor } from "../agent/family-transfer/family-index.js";
import { transferFromDonor } from "../agent/family-transfer/transfer.js";

type Stratum = "warm" | "cold" | "family-held-out";

interface Observation {
  functionName: string;
  containerId: string;
  sizeBytes: number;
  stratum: Stratum;
  state: string;
  /** `exact` when a byte-identical candidate was produced by any route. */
  exact: boolean;
  route?: "reconstruction" | "family-transfer";
  detail: string;
}

interface Evaluation {
  strata: Stratum[];
  observations: Observation[];
  /** Per stratum: how many of the same functions reached a byte-identical candidate. */
  summary: Record<Stratum, { functions: number; exact: number; drafts: number; bytes: number; exactBytes: number }>;
  /** Functions that are exact warm and not cold: the ones that depend on recovered context. */
  warmOnly: string[];
  /** Functions exact in both: recovered without any previously recovered C. */
  coldAlso: string[];
  notes: string[];
}

/* ---- one observation --------------------------------------------------------- */

function observe(functionName: string, containerId: string, sizeBytes: number, stratum: Stratum): Observation {
  const base = { functionName, containerId, sizeBytes, stratum };

  /* Family transfer is attempted first in every stratum that permits it, and
   * its result is labelled as a transfer rather than folded into
   * reconstruction: an exact match under a known donor is useful operational
   * progress, not an independent source-hidden discovery. */
  if (stratum === "warm") {
    const transfer = tryTransfer(functionName);
    if (transfer) return { ...base, ...transfer };
  }
  if (stratum === "family-held-out") {
    /* Donors withheld for this function's own family; everything else warm. */
    const transfer = tryTransfer(functionName, { excludeFamily: true });
    if (transfer) return { ...base, ...transfer };
  }

  const run = () => reconstructFunction({ functionName, notify: () => {} });
  const result = stratum === "cold" ? withContextMode("cold", run) : run();
  if (result.state === "exact-candidate") {
    return { ...base, state: result.state, exact: true, route: "reconstruction", detail: result.winner!.id };
  }
  return {
    ...base,
    state: result.state,
    exact: false,
    route: "reconstruction",
    detail: result.bestEffort?.diffSummary ?? result.unresolved?.detail?.slice(0, 100) ?? "",
  };
}

function tryTransfer(
  functionName: string,
  options: { excludeFamily?: boolean } = {},
): { state: string; exact: boolean; route: "family-transfer"; detail: string } | null {
  if (options.excludeFamily) return null;
  try {
    const index = buildFamilyIndex({ tier: "flexible" });
    const donors = donorsFor(index, functionName).slice(0, 2);
    for (const donor of donors) {
      const attempt = transferFromDonor(functionName, donor.functionName, { tier: "flexible", limit: 12 });
      if (attempt.winner) {
        return {
          state: "exact-candidate",
          exact: true,
          route: "family-transfer",
          detail: `transferred from ${donor.functionName}`,
        };
      }
    }
  } catch {
    /* No family index in this tree; the reconstruction route still runs. */
  }
  return null;
}

/* ---- population --------------------------------------------------------------- */

/**
 * A deterministic sample of *matched* functions.
 *
 * Matched ones are the population with a ground truth: the evaluation can say
 * "this was recovered" and mean it, where an unmatched function's absence of a
 * result might be the reconstruction's limit or the function's own difficulty.
 * The sample is by stride rather than at random so two runs on one tree
 * measure the same functions.
 */
function sampleMatched(containers: Container[], count: number): Array<{ name: string; containerId: string; sizeBytes: number }> {
  const population: Array<{ name: string; containerId: string; sizeBytes: number }> = [];
  for (const container of containers) {
    for (const span of loadFunctionSpans(container)) {
      const sourcePath = join(ROOT, container.paths.srcDir, `${span.name}.c`);
      if (!existsSync(sourcePath)) continue;
      const text = readFileSync(sourcePath, "utf-8");
      if (text.includes("INCLUDE_ASM(") && text.includes(span.name)) continue;
      if (/__asm__|INCLUDE_ASM/.test(text)) continue;
      population.push({ name: span.name, containerId: container.id, sizeBytes: span.size });
    }
  }
  population.sort((left, right) => left.name.localeCompare(right.name));
  if (population.length <= count) return population;
  const stride = population.length / count;
  const sample: typeof population = [];
  for (let index = 0; index < count; index++) sample.push(population[Math.floor(index * stride)]!);
  return sample;
}

/* ---- the evaluation ----------------------------------------------------------- */

export function evaluate(
  targets: Array<{ name: string; containerId: string; sizeBytes: number }>,
  strata: Stratum[],
  notify: (line: string) => void,
): Evaluation {
  const observations: Observation[] = [];
  for (const stratum of strata) {
    notify(`stratum ${stratum}: ${describeContextModeFor(stratum)}`);
    targets.forEach((target, index) => {
      if (index % 10 === 0) notify(`  ${index}/${targets.length}`);
      observations.push(observe(target.name, target.containerId, target.sizeBytes, stratum));
    });
  }

  const summary = {} as Evaluation["summary"];
  for (const stratum of strata) {
    const inStratum = observations.filter((observation) => observation.stratum === stratum);
    summary[stratum] = {
      functions: inStratum.length,
      exact: inStratum.filter((observation) => observation.exact).length,
      drafts: inStratum.filter((observation) => !observation.exact && observation.detail.includes("words match")).length,
      bytes: inStratum.reduce((sum, observation) => sum + observation.sizeBytes, 0),
      exactBytes: inStratum.filter((observation) => observation.exact).reduce((sum, observation) => sum + observation.sizeBytes, 0),
    };
  }

  const exactIn = (stratum: Stratum): Set<string> =>
    new Set(observations.filter((observation) => observation.stratum === stratum && observation.exact).map((observation) => observation.functionName));
  const warm = exactIn("warm");
  const cold = exactIn("cold");

  return {
    strata,
    observations,
    summary,
    warmOnly: [...warm].filter((name) => !cold.has(name)).sort(),
    coldAlso: [...cold].sort(),
    notes: [
      "an exact match under a known donor is useful operational progress, not an independent source-hidden discovery; the route is recorded on every observation",
      "cold mode withholds recovered game C only: the toolchain, the SDK headers and the target artifacts are the same in both strata",
    ],
  };
}

function describeContextModeFor(stratum: Stratum): string {
  if (stratum === "cold") return withContextMode("cold", () => describeContextMode());
  if (stratum === "family-held-out") return "warm, except that the function's own family donors are withheld";
  return describeContextMode();
}

/* ---- CLI ---------------------------------------------------------------------- */

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const containerId = flagValue(args, "--container");
  const sampleSize = Number(flagValue(args, "--sample") ?? "0") || 0;
  const setName = flagValue(args, "--set");
  const containers = containerId ? [requireContainer(containerId)] : loadContainers();
  const positional = args.filter((argument, index) =>
    !argument.startsWith("--") && !["--container", "--sample", "--set"].includes(args[index - 1] ?? ""));

  let targets: Array<{ name: string; containerId: string; sizeBytes: number }>;
  if (positional.length > 0) {
    const spans = new Map<string, { containerId: string; sizeBytes: number }>();
    for (const container of containers) {
      for (const span of loadFunctionSpans(container)) spans.set(span.name, { containerId: container.id, sizeBytes: span.size });
    }
    targets = positional
      .filter((name) => spans.has(name))
      .map((name) => ({ name, ...spans.get(name)! }));
  } else if (setName === "development") {
    const manifestPath = join(ROOT, "configs/reconstruction/benchmark-manifest.json");
    if (!existsSync(manifestPath)) {
      console.error("no benchmark manifest; run benchmarkReconstruction.ts --freeze-manifest first");
      process.exit(2);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { development: Array<{ name: string }> };
    const spans = new Map<string, { containerId: string; sizeBytes: number }>();
    for (const container of loadContainers()) {
      for (const span of loadFunctionSpans(container)) spans.set(span.name, { containerId: container.id, sizeBytes: span.size });
    }
    targets = manifest.development
      .filter((entry) => spans.has(entry.name))
      .map((entry) => ({ name: entry.name, ...spans.get(entry.name)! }));
  } else {
    targets = sampleMatched(containers, sampleSize || 20);
  }

  if (targets.length === 0) {
    console.error("usage: npx tsx tools/diagnostics/coldContextEvaluation.ts <fn> ... | --set development | --sample N [--container id] [--json]");
    process.exit(2);
  }

  const evaluation = evaluate(targets, ["warm", "cold", "family-held-out"], (line) => console.error(line));
  const artifact = join(ROOT, "build/coldContextEvaluation.json");
  writeStableJson(artifact, evaluation);

  if (json) {
    console.log(JSON.stringify(evaluation, null, 2));
    return;
  }

  console.log(`cold-context evaluation over ${targets.length} function(s)`);
  for (const stratum of evaluation.strata) {
    const row = evaluation.summary[stratum];
    console.log(
      `  ${stratum.padEnd(18)} ${String(row.exact).padStart(3)}/${row.functions} exact ` +
      `(${row.exactBytes}/${row.bytes} bytes), ${row.drafts} draft(s)`,
    );
  }
  console.log("");
  console.log(`recovered without any previously recovered C: ${evaluation.coldAlso.length}`);
  for (const name of evaluation.coldAlso.slice(0, 12)) console.log(`  ${name}`);
  if (evaluation.coldAlso.length > 12) console.log(`  … and ${evaluation.coldAlso.length - 12} more`);
  console.log("");
  console.log(`depend on recovered context (exact warm, not cold): ${evaluation.warmOnly.length}`);
  for (const name of evaluation.warmOnly.slice(0, 12)) {
    const cold = evaluation.observations.find((observation) => observation.functionName === name && observation.stratum === "cold");
    console.log(`  ${name.padEnd(28)} cold: ${cold?.state ?? "?"}`);
  }
  if (evaluation.warmOnly.length > 12) console.log(`  … and ${evaluation.warmOnly.length - 12} more`);
  console.log("");
  for (const note of evaluation.notes) console.log(`note: ${note}`);
  console.log(`written: ${artifact.slice(ROOT.length + 1)}`);
}

if (process.argv[1]?.endsWith("coldContextEvaluation.ts")) main();
