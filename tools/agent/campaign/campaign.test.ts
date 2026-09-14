/**
 * The project-wide campaign: an evidence graph that bounds what a recovery
 * changes, a loop that converges, a bundle that hands on what it could not
 * finish, and an integration that either lands whole or not at all.
 *
 * The properties worth holding are the ones that stop working silently.
 * A requeue set that quietly becomes "the project" turns a fixed point into a
 * rerun. A bundle that fills a hole with compilable placeholder C looks better
 * and costs more. An integration that writes three files and fails on the
 * fourth leaves a tree nothing downstream can reason about.
 */

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { buildEvidenceGraph, dependentsOf, describeGraph } from "./evidence-graph.js";
import { runCampaign } from "./campaign.js";
import { prepareBundle, renderBundle } from "./bundle.js";
import { applyTransaction, planIntegration } from "./integration.js";
import { reconstructFunction } from "../matching-reconstruction/engine.js";
import { loadContainers, requireContainer } from "../../lib/container.js";
import { transferFromDonor } from "../family-transfer/transfer.js";
import { publishRecovered, retractRecovered } from "./artifact-overlay.js";

/* A private overlay: the test files run in separate processes and the overlay
 * is shared mutable state, so publishing in one would land in another's
 * measurement. */
process.env["PSX_OVERLAY_ROOT"] = join(ROOT, "build/testOverlay/campaignTest");

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/* One overlay keeps these bounded; the relations under test are the same. */
const overlay = () => [requireContainer("ovl_11")];

/* ---- the evidence graph ------------------------------------------------------- */

projectTest("a recovered function changes its dependents, not the project", () => {
  const graph = buildEvidenceGraph({ containers: overlay() });
  const sizes = graph.functions.map((name) => dependentsOf(graph, name).size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)]!;
  assert.ok(median < 20, `the median dependent set is ${median}; a requeue this wide is a rerun`);
  assert.ok(sizes[sizes.length - 1]! < graph.functions.length / 2, "no function requeues half the container");
});

projectTest("a callee's callers are its dependents", () => {
  const graph = buildEvidenceGraph({ containers: overlay() });
  const callee = [...graph.callersOf.entries()].find(([, callers]) => callers.size >= 2);
  assert.ok(callee, "the overlay has a function called from more than one place");
  const [name, callers] = callee!;
  const dependents = dependentsOf(graph, name);
  for (const caller of callers) assert.ok(dependents.has(caller), `${caller} calls ${name} and must be requeued by it`);
});

projectTest("a family member's peers are its dependents", () => {
  const graph = buildEvidenceGraph({ containers: overlay() });
  const member = [...graph.familyOf.entries()].find(([, peers]) => peers.size > 0);
  assert.ok(member, "the overlay has at least one family");
  const dependents = dependentsOf(graph, member![0]);
  for (const peer of member![1]) assert.ok(dependents.has(peer));
});

projectTest("a global half the container reads is not a dependency between its readers", () => {
  const graph = buildEvidenceGraph({ containers: overlay(), storageFanoutLimit: 4 });
  assert.ok(
    graph.notes.some((note) => note.includes("not treated as dependencies")),
    "the filter is applied and said so",
  );
  const summary = describeGraph(graph);
  assert.ok(summary.some((line) => line.includes("median dependent set")));
});

/* ---- the campaign -------------------------------------------------------------- */

projectTest("a bounded campaign settles what it can and keeps everything at the stop", () => {
  const report = runCampaign({
    containers: overlay(),
    maxAttempts: 12,
    maxRounds: 2,
    notify: () => {},
  });
  assert.ok(report.considered.length > 0, "it attempted something");
  assert.ok(report.considered.length <= 12, "and it respected the budget");
  assert.equal(report.outcomes.length, report.considered.length, "every attempt has an outcome");
  assert.ok(
    report.notes.some((note) => note.includes("budget")) || report.unreached.length === 0,
    "a stop is stated rather than silent",
  );
  for (const outcome of report.outcomes) {
    assert.ok(outcome.detail.length > 0, `${outcome.functionName} has no detail`);
  }
});

projectTest("a campaign writes nothing to the source tree", () => {
  const containers = loadContainers();
  const before = new Map<string, string>();
  for (const container of containers.filter((candidate) => candidate.id === "ovl_11")) {
    const directory = join(ROOT, container.paths.srcDir);
    if (!existsSync(directory)) continue;
    for (const name of ["ovl_11_func_800D5B3C.c", "ovl_11_func_800D5BBC.c"]) {
      const path = join(directory, name);
      if (existsSync(path)) before.set(path, readFileSync(path, "utf-8"));
    }
  }
  runCampaign({ containers: overlay(), maxAttempts: 4, maxRounds: 1, notify: () => {} });
  for (const [path, content] of before) {
    assert.equal(readFileSync(path, "utf-8"), content, `${path} was modified by a campaign`);
  }
});

/* ---- the prepared bundle -------------------------------------------------------- */

projectTest("a bundle carries all eight sections", () => {
  const bundle = prepareBundle("ovl_11_func_800D41A4");
  const text = renderBundle(bundle).join("\n");
  for (const heading of [
    "## 1. Draft", "## 2. Source-to-target mapping", "## 3. Recovered context",
    "## 4. Alternatives", "## 5. Residual", "## 6. Closed experiments",
    "## 7. Next work item", "## 8. Integration plan",
  ]) {
    assert.ok(text.includes(heading), `the bundle is missing ${heading}`);
  }
});

projectTest("a function with no draft says so and names the capability", () => {
  /* The copy family is refused before any candidate exists. */
  reconstructFunction({ functionName: "ovl_17_func_800B9FA8", notify: () => {} });
  const bundle = prepareBundle("ovl_17_func_800B9FA8");
  assert.equal(bundle.draft.kind, "none");
  if (bundle.draft.kind === "none") {
    assert.ok(bundle.draft.reason.length > 0);
    assert.ok(bundle.draft.capability.length > 0, "the capability that would produce a draft is named");
  }
  const text = renderBundle(bundle).join("\n");
  assert.ok(!text.includes("```c"), "no C is emitted where there is no draft");
  assert.ok(text.includes("Nothing is emitted in its place"), "and the absence is stated, not implied");
});

projectTest("a bundle's next work item is a move, not a score", () => {
  const bundle = prepareBundle("ovl_11_func_800D5ABC");
  assert.ok(bundle.nextWorkItem.statement.length > 20);
  assert.ok(
    !/^\d+\/\d+/.test(bundle.nextWorkItem.statement),
    `the work item states an action, not a ratio: ${bundle.nextWorkItem.statement}`,
  );
});

projectTest("a bundle records the recovered context even with no draft", () => {
  const bundle = prepareBundle("ovl_17_func_800B9FA8");
  assert.ok(bundle.context.calls.length > 0, "call sites resolve without any execution");
  assert.ok(bundle.context.operations.length > 0, "and the block move is recovered as an operation");
  assert.ok(bundle.mapping.structure.length > 0, "the structure is recovered too");
});

/* ---- transactional integration --------------------------------------------------- */

projectTest("an exact candidate plans an integration that verifies", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_800BF3D0", notify: () => {} });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  const planned = planIntegration("ovl_11_func_800BF3D0");
  assert.ok(!("refused" in planned), `planning refused: ${JSON.stringify(planned)}`);
  if ("refused" in planned) return;
  assert.equal(planned.patches.length, 1);
  assert.match(planned.patches[0]!.after, /#include "common\.h"/);
  assert.ok(!/typedef signed int s32;/.test(planned.patches[0]!.after), "the candidate's own scalar typedefs are dropped for common.h");
  const applied = applyTransaction(planned, { write: false });
  assert.equal(applied.status, "would-apply", JSON.stringify(applied));
});

projectTest("a dry-run integration leaves the source file untouched", () => {
  reconstructFunction({ functionName: "ovl_11_func_800BF3D0", notify: () => {} });
  const path = join(ROOT, "src/overlays/ovl_11/ovl_11_func_800BF3D0.c");
  const before = existsSync(path) ? readFileSync(path, "utf-8") : null;
  const planned = planIntegration("ovl_11_func_800BF3D0");
  if (!("refused" in planned)) applyTransaction(planned, { write: false });
  const after = existsSync(path) ? readFileSync(path, "utf-8") : null;
  assert.equal(after, before, "a dry run wrote to the tree");
});

projectTest("a candidate that no longer reproduces the target is refused", () => {
  reconstructFunction({ functionName: "ovl_11_func_800BF3D0", notify: () => {} });
  const planned = planIntegration("ovl_11_func_800BF3D0");
  assert.ok(!("refused" in planned));
  if ("refused" in planned) return;
  /* Corrupt the candidate: a shift by one bit more is a program that compiles
   * and is not this function. */
  const corrupted = {
    ...planned,
    patches: planned.patches.map((patch) => ({ ...patch, after: patch.after.replace(">> 7", ">> 6") })),
  };
  assert.notEqual(corrupted.patches[0]!.after, planned.patches[0]!.after, "the probe actually changed the source");
  const result = applyTransaction(corrupted, { write: false });
  assert.equal(result.status, "refused");
  if (result.status === "refused") assert.match(result.reason, /mismatch|does not compile/);
});

projectTest("a family transfer's winner integrates through the overlay", () => {
  /* A transfer writes no reconstruction result, so a function recovered
   * entirely by substitution used to have no route into the tree and had to be
   * staged by hand. The overlay is that route, and its entry bar is the same
   * bar integration enforces. */
  const target = "ovl_11_func_800F4114";
  const donor = "ovl_21_func_800BA670";
  retractRecovered();
  const before = planIntegration(target);
  assert.ok("refused" in before, "the engine has only a draft for this one");

  const transfer = transferFromDonor(target, donor, { tier: "flexible", limit: 12 });
  assert.ok(transfer.winner, "the substitution reproduces the target");
  const published = publishRecovered(target, transfer.winner!.source, "family-transfer");
  assert.ok(!("refused" in published), JSON.stringify(published));

  const after = planIntegration(target);
  assert.ok(!("refused" in after), JSON.stringify(after));
  const applied = applyTransaction(after as Parameters<typeof applyTransaction>[0], { write: false });
  assert.equal(applied.status, "would-apply", JSON.stringify(applied));
  retractRecovered();
});

projectTest("the candidate's scalar typedefs are dropped and its views are kept", () => {
  /* Both by name. The scalar typedefs were being dropped by a vacuous `every`
   * over a list of names nothing could read, which would have taken an
   * invented view typedef with them. */
  const planned = planIntegration("ovl_11_func_800BF3D0");
  assert.ok(!("refused" in planned), JSON.stringify(planned));
  const transaction = planned as Parameters<typeof applyTransaction>[0];
  const after = transaction.patches[0]!.after;
  assert.ok(!/typedef signed char s8;/.test(after), "the scalar typedefs come from common.h");
  assert.match(after, /typedef struct \{[\s\S]*\} Recon\w*View;/, "the invented view stays");
  assert.ok(transaction.notes.some((note) => /dropped the candidate's declaration of s8\b/.test(note)),
    `the notes name what was dropped: ${transaction.notes.join("; ")}`);
});

projectTest("a function with no exact candidate is refused rather than integrated", () => {
  reconstructFunction({ functionName: "ovl_11_func_800D41A4", notify: () => {} });
  const planned = planIntegration("ovl_11_func_800D41A4");
  assert.ok("refused" in planned, "a best-effort draft is handed on in a bundle, not written to src/");
  if ("refused" in planned) assert.match(planned.refused, /not an exact candidate|no draft/);
});
