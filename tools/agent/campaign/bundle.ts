/**
 * The prepared reconstruction bundle — the agent handoff as a product.
 *
 * The failure this replaces: an agent picking up an unfinished function got an
 * error string and a directory containing whichever C file happened to exist,
 * and had to reconstruct the engine's reasoning from it. Everything it needed
 * had already been computed and then thrown away.
 *
 * A bundle carries eight things, and each is separately checkable:
 *
 *   1. a primary draft, compiling against real context where the machine
 *      semantics are supported — and *absent*, explicitly, where they are not,
 *      rather than filled in with a placeholder that compiles;
 *   2. the source-to-target mapping and the exact oracle inputs;
 *   3. recovered context: parameters, callee signatures with their evidence
 *      tier, field geometry, storage origins, recognised operations;
 *   4. a small alternative set — materially different readings, not twenty
 *      spellings of one;
 *   5. residuals with their confidence, per region, separating semantic
 *      uncertainty from code-generation disagreement;
 *   6. closed experiments: what was tried, under which flags, and what would
 *      reopen them;
 *   7. the next bounded work item;
 *   8. an integration plan.
 *
 * The rule the whole structure rests on: **a hole is a hole.** Where the
 * machine semantics are not supported, the bundle says so and names the
 * capability. It never emits a compilable no-op in the gap, because a draft
 * that compiles and is wrong costs more than one that does not compile and
 * says why.
 */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import type { PacketSource, PreparationPacket } from "./packet.js";
import { ROOT, configuredCc1FlagsForContainer, loadFlagOverrides } from "../decompToolchain.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import { recoverContext, renderContext, type RecoveredContext } from "../matching-reconstruction/context-product.js";
import { buildMachineIr, renderMachineIr, type MachineIrReport } from "../machine-ir/index.js";
import { renderRegions } from "../machine-ir/regions.js";
import { isRefusal, loadResult, readResultArtifact, type LoadedResult } from "../matching-reconstruction/result-contract.js";
import { repairReport, type RepairReport } from "../nearMissRepair.js";
import { donorNamesFor } from "../family-transfer/replay.js";
import type { ResultBundle } from "../matching-reconstruction/types.js";

export const PREPARED_BUNDLE_SCHEMA_VERSION = 1 as const;

export interface PreparedBundle {
  schemaVersion: typeof PREPARED_BUNDLE_SCHEMA_VERSION;
  functionName: string;
  containerId: string;
  vram: number;
  sizeBytes: number;

  /** Common source identity, independent of compilability. */
  primary?: PacketSource;
  preparation?: PreparationPacket;
  /** 1. The primary draft, or the reason there is none. */
  draft:
    | { kind: "exact"; source: string; note: string }
    | { kind: "partial"; source: string; note: string }
    | { kind: "uncompiled"; source: string; note: string }
    | { kind: "none"; reason: string; capability: string };

  /** 2. Where the draft's regions correspond to the target, and the oracle's inputs. */
  mapping: {
    /** The structured regions of the target, as the IR recovered them. */
    structure: string[];
    /** Exact inputs the byte oracle compares. */
    oracle: { target: string; container: string; flags: string[] };
  };

  /** 3. Recovered context: interface, storage, operations, all with evidence. */
  context: RecoveredContext;

  /** 4. Materially different readings, never spellings of one. */
  alternatives: Array<{ label: string; rationale: string; source?: string }>;

  /** 5. Residual, localised, with the kind of uncertainty each part carries. */
  residual: {
    /** Words that differ, placed in the target's own blocks. */
    placed: RepairReport["implicated"];
    /** Regions whose machine semantics the model does not carry at all. */
    unsupported: Array<{ vram: number; op: string; capability: string }>;
    summary: string;
  };

  /** 6. What has been tried, under what, and what would reopen it. */
  closedExperiments: Array<{ what: string; verdict: string; flags: string[]; reopensIf: string }>;

  /** 7. The next bounded work item. */
  nextWorkItem: { statement: string; alternatives: string[] };

  /** 8. What an authorized integration would have to change. */
  integrationPlan: string[];
}

/* ---- assembly ---------------------------------------------------------------- */

/**
 * Build one function's prepared bundle.
 *
 * Everything here already exists somewhere in the tree; the bundle's job is to
 * bring it together *and to be honest about what is missing*. A bundle for a
 * function nothing has run on is still a bundle: it carries the context, the
 * structure and the capability that is missing, which is strictly more than
 * the error string it replaces.
 */
export function prepareBundle(functionName: string, preparation?: PreparationPacket): PreparedBundle {
  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const context = recoverContext(functionName);
  const ir = buildMachineIr(functionName);
  const override = loadFlagOverrides().get(functionName);
  const flags = [...configuredCc1FlagsForContainer(container.kind), ...(override ?? [])];

  const loaded = loadResult(functionName);
  const bundleResult: (ResultBundle & { provenance?: unknown }) | null = isRefusal(loaded) ? null : (loaded as LoadedResult).bundle;

  const draft: PreparedBundle["draft"] = preparation?.primary ? {
    kind: preparation.compilation.status !== "succeeded" ? "uncompiled" : preparation.comparison.status === "exact" ? "exact" : "partial",
    source: preparation.primary.text, note: `measured source ${preparation.primary.path}; compilation ${preparation.compilation.status}; comparison ${preparation.comparison.status}`,
  } : draftOf(loaded, bundleResult, ir, context);
  const primary: PacketSource | undefined = preparation?.primary ?? (draft.kind !== "none" && !isRefusal(loaded) ? {
    origin: "reconstruction", text: draft.source,
    path: relative(ROOT, join(loaded.directory, draft.kind === "exact" ? "winner.c" : "best-effort.c")),
    sha256: createHash("sha256").update(draft.source).digest("hex"), declarationsRequired: [],
  } : undefined);
  const repair = safeRepairReport(functionName);

  return {
    schemaVersion: PREPARED_BUNDLE_SCHEMA_VERSION,
    functionName,
    containerId: container.id,
    vram: location.span.vram,
    sizeBytes: location.span.size,
    draft,
    ...(primary ? { primary } : {}),
    ...(preparation ? { preparation } : {}),
    mapping: {
      structure: renderRegions(ir.regions.root, "  "),
      oracle: {
        target: `${container.targetPath} @ 0x${location.span.vram.toString(16)} (${location.span.size} bytes)`,
        container: container.id,
        flags,
      },
    },
    context,
    alternatives: alternativesOf(bundleResult, repair, ir),
    residual: residualOf(bundleResult, repair, ir),
    closedExperiments: closedExperimentsOf(bundleResult, flags),
    nextWorkItem: nextWorkItemOf(functionName, bundleResult, repair, ir, context),
    integrationPlan: integrationPlanOf(functionName, bundleResult, container.paths.srcDir, override),
  };
}

function safeRepairReport(functionName: string): RepairReport | null {
  try {
    return repairReport(functionName);
  } catch {
    return null;
  }
}

/**
 * The draft, and the honest absence of one.
 *
 * `partial` is reserved for a source that compiles and does not reproduce the
 * target; `none` names the capability that would produce one. Neither is a
 * placeholder: there is no state in which this function emits C it cannot
 * justify.
 */
function draftOf(
  loaded: ReturnType<typeof loadResult>,
  result: ResultBundle | null,
  ir: MachineIrReport,
  context: RecoveredContext,
): PreparedBundle["draft"] {
  if (result && !isRefusal(loaded)) {
    const read = result.winner
      ? readResultArtifact(loaded as LoadedResult, "winner.c")
      : result.bestEffort
        ? readResultArtifact(loaded as LoadedResult, "best-effort.c")
        : { refused: "not-in-manifest" as const, detail: "the result carries no draft" };
    if (!isRefusal(read)) {
      return result.winner
        ? { kind: "exact", source: read.content, note: "byte-identical to the target under the effective flags; not integrated" }
        : {
            kind: "partial",
            source: read.content,
            note: `compiles and does not reproduce the target (${result.bestEffort?.diffSummary ?? "residual unmeasured"})`,
          };
    }
  }

  /* No draft. The capability that would produce one is the honest answer, and
   * it is available whether or not anything has been run. */
  const unmodelled = [...new Set(ir.unmodelled.map((item) => item.op))];
  if (unmodelled.length > 0) {
    return {
      kind: "none",
      reason: `${ir.unmodelled.length} word(s) are outside the modelled instruction set (${unmodelled.join(", ")})`,
      capability: context.operations.length > 0
        ? `recognise and construct the ${context.operations[0]!.summary}`
        : "model these instructions, or recognise the operation they implement",
    };
  }
  const category = result?.unresolved?.category;
  return {
    kind: "none",
    reason: result?.unresolved?.detail ?? "no reconstruction has been run for this function",
    capability: category
      ? `the ${category} capability`
      : "run the reconstruction engine, or transfer from a family donor",
  };
}

/**
 * Materially different readings.
 *
 * The filter is the plan's: materially different source, layout or control
 * branches — not twenty spellings producing the same code. A donor transfer, a
 * recognised construction and a different loop form are three readings; three
 * ways to write the same subscript are one.
 */
function alternativesOf(
  result: ResultBundle | null,
  repair: RepairReport | null,
  ir: MachineIrReport,
): PreparedBundle["alternatives"] {
  const alternatives: PreparedBundle["alternatives"] = [];

  for (const donor of repair?.donors.slice(0, 2) ?? []) {
    alternatives.push({
      label: `transfer from ${donor}`,
      rationale: "a family member with clean C and the same word shape; one compile settles it",
    });
  }
  for (const construction of repair?.constructions.slice(0, 3) ?? []) {
    alternatives.push({
      label: construction.recipeId,
      rationale: `${construction.note}${construction.differences.length > 0
        ? `, with ${construction.differences.map((difference) => `${difference.kind} 0x${(difference.queryValue >>> 0).toString(16)}`).join(", ")}`
        : ""}`,
    });
  }
  if (ir.regions.sharedTails.length > 0) {
    alternatives.push({
      label: "factored against duplicated shared tail",
      rationale: `B${ir.regions.sharedTails.join(", B")} ${ir.regions.sharedTails.length === 1 ? "is reached" : "are reached"} by more than one path; ` +
        "one variable and one exit, or the work written in each arm, are different programs",
    });
  }
  if (ir.regions.loops.length > 0) {
    alternatives.push({
      label: "loop form",
      rationale: `${ir.regions.loops.length} loop(s); index against cursor, entry-guarded against do-while, and up against down are distinct constructions`,
    });
  }
  for (const origin of result?.origins?.slice(0, 3) ?? []) {
    alternatives.push({
      label: origin.kind === "standalone" ? `standalone ${origin.symbol}` : `embedded in ${origin.parentSymbol}+0x${origin.offset.toString(16)}`,
      rationale: origin.evidence[0] ?? "a witnessed origin for the scanned storage",
    });
  }
  return alternatives;
}

/** Residual, separated into what differs and what is not representable at all. */
function residualOf(
  result: ResultBundle | null,
  repair: RepairReport | null,
  ir: MachineIrReport,
): PreparedBundle["residual"] {
  const unsupported = ir.unmodelled.map((item) => ({
    vram: item.vram,
    op: item.op,
    capability: item.note,
  }));
  const placed = repair?.implicated ?? [];
  const differing = result?.bestEffort?.differingCount;
  const summary = result?.winner
    ? "no residual: the draft is byte-identical"
    : differing !== undefined
      ? `${differing} word(s) differ; ${placed.length} block(s) implicated` +
        (unsupported.length > 0 ? `, and ${unsupported.length} word(s) are not representable at all` : "")
      : unsupported.length > 0
        ? `no draft; ${unsupported.length} word(s) are outside the model`
        : "no draft and no measured residual";
  return { placed, unsupported, summary };
}

/**
 * Experiments already closed, with the conditions that reopen them.
 *
 * A candidate that compiled and mismatched is a closed experiment: under these
 * flags, that source is not this function. It reopens when the flags change,
 * when the interpretation it rests on changes, or when a capability it needed
 * arrives — which is why each entry carries its own condition rather than a
 * blanket "retry later".
 */
function closedExperimentsOf(result: ResultBundle | null, flags: string[]): PreparedBundle["closedExperiments"] {
  if (!result) return [];
  const closed: PreparedBundle["closedExperiments"] = [];
  for (const candidate of result.candidates) {
    if (candidate.verdict === "match") continue;
    closed.push({
      what: candidate.id,
      verdict: candidate.compileError
        ? `did not compile: ${candidate.compileError.split("\n")[0]}`
        : `${candidate.verdict} (${candidate.matchedWords ?? "?"}/${candidate.totalWords ?? "?"} words)`,
      flags,
      reopensIf: candidate.compileError
        ? "the context it needs becomes available"
        : "the flag column changes, or an upstream interpretation it rests on changes",
    });
  }
  return closed.slice(0, 24);
}

/** The next bounded work item: one statement, with its alternatives. */
function nextWorkItemOf(
  functionName: string,
  result: ResultBundle | null,
  repair: RepairReport | null,
  ir: MachineIrReport,
  context: RecoveredContext,
): PreparedBundle["nextWorkItem"] {
  if (result?.winner) {
    return {
      statement: `${functionName} has a byte-identical candidate; the remaining work is authorized integration, not reconstruction`,
      alternatives: ["run finalizeEngineMatches for this function and verify with the repository's full gate"],
    };
  }
  const moves = repair?.moves ?? [];
  if (moves.length > 0) {
    return { statement: moves[0]!, alternatives: moves.slice(1) };
  }
  if (ir.unmodelled.length > 0) {
    const operation = context.operations[0];
    return {
      statement: operation
        ? `construct the ${operation.summary} this function performs; no source edit reaches its expansion`
        : `model or recognise the ${[...new Set(ir.unmodelled.map((item) => item.op))].join(", ")} words`,
      alternatives: [],
    };
  }
  return {
    statement: `run the reconstruction engine on ${functionName} to produce a draft and a measured residual`,
    alternatives: [`look ${functionName} up in the recipe atlas`, `check whether ${functionName} has a family donor`],
  };
}

/** What an authorized integration would change. Never applied here. */
function integrationPlanOf(
  functionName: string,
  result: ResultBundle | null,
  srcDir: string,
  override: string[] | undefined,
): string[] {
  const plan: string[] = [
    `the candidate belongs at ${join(srcDir, `${functionName}.c`)}`,
  ];
  if (override) plan.push(`this translation unit carries a per-file flag override (${override.join(" ")}); it is already applied`);
  for (const step of result?.winner?.integrationPlan ?? result?.bestEffort?.integrationPlan ?? []) plan.push(step);
  plan.push("shared view types belong in the shared type header named by the generated profile, not in the function's own file");
  plan.push("verify with the repository's full gate before reporting success; a byte match does not excuse a forbidden construct");
  return plan;
}

/* ---- rendering ----------------------------------------------------------------- */

export function renderBundle(bundle: PreparedBundle): string[] {
  const lines: string[] = [];
  lines.push(`# ${bundle.functionName} — prepared reconstruction bundle`);
  lines.push("");
  lines.push(`Target: ${bundle.containerId} @ 0x${bundle.vram.toString(16)}, ${bundle.sizeBytes} bytes`);
  lines.push("");

  lines.push("## 1. Draft");
  if (bundle.draft.kind === "none") {
    lines.push(`No draft. ${bundle.draft.reason}`);
    lines.push(`The capability that would produce one: ${bundle.draft.capability}`);
    lines.push("");
    lines.push("Nothing is emitted in its place. A compilable placeholder in this gap would be a program");
    lines.push("that is not this function, and it would cost more to discover than its absence costs now.");
  } else {
    lines.push(`${bundle.draft.kind === "exact" ? "Byte-identical" : bundle.draft.kind === "uncompiled" ? "Uncompiled draft" : "Partial"} — ${bundle.draft.note}`);
    lines.push("");
    lines.push("```c");
    lines.push(bundle.draft.source.trimEnd());
    lines.push("```");
  }
  lines.push("");

  lines.push("## 2. Source-to-target mapping");
  lines.push(`Oracle input: ${bundle.mapping.oracle.target}`);
  lines.push(`Flags: ${bundle.mapping.oracle.flags.join(" ")}`);
  lines.push("");
  lines.push("Structure:");
  lines.push("```");
  for (const line of bundle.mapping.structure) lines.push(line);
  lines.push("```");
  lines.push("");

  lines.push("## 3. Recovered context");
  lines.push("```");
  for (const line of renderContext(bundle.context)) lines.push(line);
  lines.push("```");
  lines.push("");

  lines.push("## 4. Alternatives");
  if (bundle.alternatives.length === 0) lines.push("None found: this function is a new representative.");
  for (const alternative of bundle.alternatives) lines.push(`- **${alternative.label}** — ${alternative.rationale}`);
  lines.push("");

  lines.push("## 5. Residual");
  lines.push(bundle.residual.summary);
  for (const region of bundle.residual.placed) {
    lines.push(
      `- B${region.block} @ 0x${region.vram.toString(16)}: ${region.differingWords} word(s), ${region.role}` +
      `${region.loopHeader !== undefined ? `, inside the loop at B${region.loopHeader}` : ""}` +
      `${region.sharedTail ? ", shared tail" : ""}`,
    );
  }
  for (const item of bundle.residual.unsupported.slice(0, 8)) {
    lines.push(`- 0x${item.vram.toString(16)} ${item.op}: ${item.capability}`);
  }
  if (bundle.residual.unsupported.length > 8) {
    lines.push(`- … and ${bundle.residual.unsupported.length - 8} further unrepresentable word(s)`);
  }
  lines.push("");

  lines.push("## 6. Closed experiments");
  if (bundle.closedExperiments.length === 0) lines.push("None.");
  for (const experiment of bundle.closedExperiments.slice(0, 12)) {
    lines.push(`- \`${experiment.what}\`: ${experiment.verdict} — reopens if ${experiment.reopensIf}`);
  }
  if (bundle.closedExperiments.length > 12) {
    lines.push(`- … and ${bundle.closedExperiments.length - 12} more`);
  }
  lines.push("");

  lines.push("## 7. Next work item");
  lines.push(bundle.nextWorkItem.statement);
  for (const alternative of bundle.nextWorkItem.alternatives) lines.push(`- or: ${alternative}`);
  lines.push("");

  lines.push("## 8. Integration plan");
  for (const step of bundle.integrationPlan) lines.push(`- ${step}`);
  lines.push("");

  return lines;
}

/** Where a function's prepared bundle is written. */
export function bundlePath(functionName: string, extension: "md" | "json"): string {
  return join(ROOT, "build/preparedBundles", `${functionName}.${extension}`);
}

/** True when the tree is configured enough to prepare a bundle. */
export function bundlesAvailable(): boolean {
  return existsSync(join(ROOT, "configs/splat"));
}
