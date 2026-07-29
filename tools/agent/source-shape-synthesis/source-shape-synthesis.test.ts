import assert from "node:assert/strict";
import test from "node:test";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { validateSourceShapeSpec } from "../source-shape-search/schema.js";
import { buildSourceModel } from "./source-model.js";
import { deriveSynthesisPlan, sourceShapeSpec } from "./planner.js";

const source = `#include "common.h"
void *func_test(s32 *ptr, void *out, u32 arg2, s32 arg3, u32 arg8)
{
    u32 saved;
    s16 narrow;
    u32 nibble;

    arg2 &= 0xFFFF;
    nibble = arg2 & 0xF;
    arg2 &= 0xF0;
    saved = arg8;
    setSprt(out);
    narrow = (s16)arg3;
    __asm__ volatile("" ::: "memory");

    addPrim(ptr, out);
    return out;
}
`;

function instruction(index: number, canonical: string) {
  const [mnemonic = "", ...rest] = canonical.split(" ");
  return { index, canonical, mnemonic, operands: rest.join(" ").split(",") };
}

function analysis(): TargetScheduleAnalysis {
  const target = [
    instruction(0, "move t0,a1"),
    instruction(1, "li v0,4"),
    instruction(2, "li v1,100"),
    instruction(3, "move t3,a0"),
    instruction(4, "andi a2,a2,65535"),
    instruction(5, "sll a3,a3,16"),
    instruction(6, "sra t5,a3,16"),
    instruction(7, "andi t6,a2,15"),
    instruction(8, "andi a2,a2,240"),
    instruction(9, "lw a1,32(sp)"),
  ];
  const candidate = [target[0]!, target[4]!, target[7]!, target[8]!, target[1]!, target[2]!, target[3]!, target[5]!, target[9]!, target[6]!]
    .map((item, index) => ({ ...item, index, uid: index + 10 }));
  return {
    schemaVersion: 2,
    function: "func_test",
    source: "src/func_test.c",
    outputDirectory: "build/targetSchedule/func_test",
    traceArtifact: "build/compilerTrace/func_test/report.json",
    target,
    candidate,
    correspondence: target.map((item) => {
      const candidateIndex = candidate.findIndex((entry) => entry.canonical === item.canonical);
      return { targetIndex: item.index, candidateIndex, candidateUid: candidateIndex + 10, confidence: "exact", evidence: [] };
    }),
    registerRoles: [],
    emissionAlignment: [],
    machineUidLinks: [],
    schedulerSelections: [],
    schedulerReplay: [],
    baselineReplay: [],
    targetOrderConstraints: [],
    targetOrderReplays: [],
    interventionSets: [],
    allocationRequirements: [],
    delaySlots: [],
    requirements: [{
      id: "prologue-order",
      stage: "sched",
      description: "reorder prologue",
      targetIndexes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      targetCanonical: target.slice(1).map((item) => item.canonical),
      candidateIndexes: candidate.slice(1).map((item) => item.index),
      candidateUids: candidate.slice(1).map((item) => item.uid!),
      pseudos: [],
      hardConstraint: false,
      interventions: [{
        id: "luid",
        stage: "sched",
        kind: "luid-order",
        uids: [10, 11],
        pseudos: [],
        expectedEffect: "change LUID order",
        sourceMechanisms: ["statement-birth-order"],
        confidence: "reconstructed",
        evidence: [],
      }],
      confidence: "reconstructed",
      evidence: [],
    }],
    preservationRanges: [{ start: 0, end: 0, exact: true }],
    firstDivergence: { targetIndex: 1, candidateIndex: 1, stage: "sched", description: "order" },
    caveats: [],
  };
}

test("models a conservative C89 prologue and stops at an inherited barrier", () => {
  const model = buildSourceModel("func_test", "src/func_test.c", source);
  assert.deepEqual(model.parameters.map((item) => item.name), ["ptr", "out", "arg2", "arg3", "arg8"]);
  assert.deepEqual(model.declarations.map((item) => item.name), ["saved", "narrow", "nibble"]);
  assert.equal(model.prologueStatements.length, 6);
  assert.equal(model.prologueStatements[0]?.lhs, "arg2");
  assert.equal(model.prologueStatements[4]?.macro, "setSprt");
  assert.match(model.caveats.join("\n"), /protected source barrier/);
});

test("derives finite clean-C mechanism recipes and preserves scalar dependencies", () => {
  const model = buildSourceModel("func_test", "src/func_test.c", source);
  const plan = deriveSynthesisPlan({
    functionName: "func_test",
    sourcePath: "src/func_test.c",
    source,
    analysisPath: "build/targetSchedule/func_test/analysis.json",
    analysis: analysis(),
    maxVariants: 80,
    maxDepth: 3,
  }, model);
  assert.equal(plan.alternatives.length, 79);
  assert.ok(plan.roles.some((role) => role.role === "setSprt"));
  assert.ok(plan.roles.some((role) => role.role === "pointer-argument-copy"));
  assert.ok(plan.recipes.some((recipe) => recipe.id === "recipe-header-expansion"));
  assert.ok(plan.recipes.some((recipe) => recipe.id === "recipe-parameter-local-copy"));
  for (const alternative of plan.alternatives) {
    const mask = alternative.statementOrder.indexOf("stmt-0");
    const nibble = alternative.statementOrder.indexOf("stmt-1");
    const secondMask = alternative.statementOrder.indexOf("stmt-2");
    if (nibble >= 0) assert.ok(mask < nibble, alternative.id);
    if (secondMask >= 0) assert.ok(mask < secondMask, alternative.id);
  }
  assert.ok(plan.alternatives.some((alternative) => alternative.statementOrder[0] === "stmt-4"));
  assert.ok(plan.alternatives.every((alternative) => alternative.recipeIds.length <= 3));

  const spec = sourceShapeSpec(plan, true);
  const validated = validateSourceShapeSpec(spec, "func_test");
  assert.equal(validated.constraints.preserveExistingEmptyMemoryBarriers, true);
  assert.equal(validated.dimensions[0]?.alternatives.length, 80);
  assert.equal(validated.traceAllPreprocessed, true);
  assert.equal(validated.scheduleComparison.enabled, true);
  assert.equal(validated.scheduleComparison.maxInterventions, 8);
});
