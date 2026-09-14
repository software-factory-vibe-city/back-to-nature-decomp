/**
 * Near-miss repair: a residual localised to the target's own structure, and
 * the source moves that follow from it.
 *
 * The test that matters is not that the tool produces output; it is that the
 * output is *placed*. A residual reported as "ten words differ" is a gauge; a
 * residual reported as "three of them are in the branch test at 0x800d41a4 and
 * two in a shared tail" is a gradient, and the difference is whether the next
 * edit is chosen or guessed.
 *
 * The refusals matter equally. A function with no draft must say so rather
 * than localise nothing and call it a clean bill, and a function whose words
 * the atlas does not recognise must say that too.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "./decompToolchain.js";
import { repairReport } from "./nearMissRepair.js";
import { reconstructFunction } from "./matching-reconstruction/engine.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

projectTest("the residual is placed in the target's own blocks", () => {
  /* Produce a draft first so the residual exists and is current. */
  reconstructFunction({ functionName: "ovl_11_func_800D41A4", notify: () => {} });
  const report = repairReport("ovl_11_func_800D41A4");
  assert.ok(report.draft, "there is a draft to report a residual for");
  assert.ok(report.implicated.length > 0, "and the residual lands somewhere nameable");
  for (const region of report.implicated) {
    assert.ok(region.differingWords > 0);
    assert.ok(region.role.length > 0, "every implicated block says what it is");
  }
  const totalPlaced = report.implicated.reduce((sum, region) => sum + region.differingWords, 0);
  assert.ok(totalPlaced > 0, "the words are attributed, not counted and dropped");
});

projectTest("a shared tail in the residual becomes an explicit move", () => {
  reconstructFunction({ functionName: "ovl_11_func_800D41A4", notify: () => {} });
  const report = repairReport("ovl_11_func_800D41A4");
  assert.ok(report.implicated.some((region) => region.sharedTail), "the handler has a shared tail");
  assert.ok(
    report.moves.some((move) => move.includes("shared tail")),
    `the move set names it; got: ${report.moves.join(" | ")}`,
  );
});

projectTest("a recognised construction becomes a move naming the constants", () => {
  const report = repairReport("ovl_11_func_80103770");
  assert.ok(report.constructions.length > 0, "the atlas recognises this loop");
  const move = report.moves.find((candidate) => candidate.includes("global-loop"));
  assert.ok(move, `a construction move is offered; got: ${report.moves.join(" | ")}`);
  assert.match(move!, /0x[0-9a-f]+/, "and it names the constant the target has");
});

projectTest("a function with no draft says so rather than reporting a clean residual", () => {
  /* ovl_17_func_800B9FA8 is refused before any candidate is constructed. */
  reconstructFunction({ functionName: "ovl_17_func_800B9FA8", notify: () => {} });
  const report = repairReport("ovl_17_func_800B9FA8");
  assert.equal(report.draft, undefined);
  assert.ok(
    report.notes.some((note) => note.includes("no draft") || note.includes("run the reconstruction engine")),
    `the absence is stated; got: ${report.notes.join(" | ")}`,
  );
});

projectTest("unmodelled words are named as out of reach of any source edit", () => {
  const report = repairReport("ovl_17_func_800B9FA8");
  assert.ok(
    report.moves.some((move) => move.includes("outside the model")),
    `the copy family's unaligned halves are named; got: ${report.moves.join(" | ")}`,
  );
});

projectTest("a family donor is offered before any source edit", () => {
  const report = repairReport("ovl_11_func_800D5ABC");
  assert.ok(report.donors.length > 0, "this function has a donor");
  assert.match(report.moves[0]!, /transfer from the family donor/, "and transferring is the cheapest move");
});
