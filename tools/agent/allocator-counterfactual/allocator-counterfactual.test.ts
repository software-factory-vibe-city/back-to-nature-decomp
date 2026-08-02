import assert from "node:assert/strict";
import test from "node:test";
import { parseRtlInstructions } from "../compiler-trace/rtl-parser.js";
import type { CompilerTraceReport, PseudoProvenance } from "../compiler-trace/types.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import {
  analyzeAllocatorCounterfactual,
  deriveAllocnoPriorities,
  gcc295AllocnoPriority,
  reconstructHardRegisterLifetimes,
} from "./analyze.js";

function pseudo(
  number: number,
  assignedRegister: string,
  allocationStage: "local" | "global/reload",
  lifetime: { block: number; birthIndex: number; deathIndex: number; birthUid?: number; deathUid?: number },
  conflicts: Array<{ register: number; kind: "pseudo" | "hard-register" }>,
): PseudoProvenance {
  return {
    pseudo: number,
    modes: ["SI"],
    userVariable: false,
    pointer: false,
    attributes: [],
    firstStage: "lreg",
    lastStage: "greg",
    stages: [],
    transitions: [],
    lifetimes: [{
      ...lifetime,
      fakeBirthIndex: lifetime.birthIndex - 1,
      fakeDeathIndex: lifetime.deathIndex + 1,
      liveIn: lifetime.birthUid === undefined,
      liveOut: lifetime.deathUid === undefined,
      confidence: "reconstructed",
    }],
    uses: 4,
    span: 10,
    sets: 1,
    assignedHardReg: assignedRegister === "a0" ? 4 : assignedRegister === "v1" ? 3 : 7,
    assignedRegister,
    allocationStage,
    preferences: [],
    conflicts: conflicts.map((conflict) => ({ ...conflict, confidence: "exact" })),
  };
}

test("reproduces GCC 2.95.2 allocno priority and verifies observed order", () => {
  assert.equal(gcc295AllocnoPriority(13, 346), 1127);
  assert.equal(gcc295AllocnoPriority(13, 350), 1114);
  const trace = {
    pseudos: [
      { ...pseudo(83, "s0", "global/reload", { block: 0, birthIndex: 0, deathIndex: 10 }, []), uses: 13, span: 346 },
      { ...pseudo(81, "s1", "global/reload", { block: 0, birthIndex: 0, deathIndex: 10 }, []), uses: 13, span: 350 },
    ],
    allocationOrder: [
      { pseudo: 83, rank: 0, assignedRegister: "s0", assignedHardReg: 16 },
      { pseudo: 81, rank: 1, assignedRegister: "s1", assignedHardReg: 17 },
    ],
  } as CompilerTraceReport;
  const result = deriveAllocnoPriorities(trace);
  assert.equal(result.verified, true);
  assert.deepEqual(result.allocnos.map((item) => item.priority), [1127, 1114]);
});

test("reconstructs an incoming hard-register death from lreg", () => {
  const content = `
;; Start of basic block 0, registers live: 4 [$4] 29 [$sp]
(insn 55 0 4 (set (reg:SI 105) (const_int 1)) -1 (nil) (nil))
(insn 4 55 0 (set (reg:SI 81) (reg:SI 4 a0)) -1 (nil)
  (expr_list:REG_DEAD (reg:SI 4 a0) (nil)))
`;
  const ranges = reconstructHardRegisterLifetimes(content, parseRtlInstructions(content, "lreg"));
  const a0 = ranges.find((range) => range.registerName === "a0")!;
  assert.deepEqual([a0.birthIndex, a0.deathIndex, a0.deathUid], [0, 1, 4]);
});

test("refines roles by UID and distinguishes incoming-hard and allocated-pseudo blockers", () => {
  const lreg = `
;; Start of basic block 0, registers live: 4 [$4]
(insn 55 0 4 (set (reg:SI 105) (const_int 1)) -1 (nil) (nil))
(insn 4 55 0 (set (reg:SI 81) (reg:SI 4 a0)) -1 (nil)
  (expr_list:REG_DEAD (reg:SI 4 a0) (nil)))
;; Start of basic block 1, registers live: 81
(insn 103 0 112 (set (reg:SI 126) (const_int 2)) -1 (nil) (nil))
(insn 112 103 105 (set (reg:SI 127) (const_int 3)) -1 (nil) (nil))
(insn 105 112 0 (set (reg:SI 106) (plus:SI (reg:SI 126) (reg:SI 127))) -1 (nil)
  (expr_list:REG_DEAD (reg:SI 126) (expr_list:REG_DEAD (reg:SI 127) (nil))))
`;
  const pseudos = [
    pseudo(105, "a3", "local", { block: 0, birthIndex: 0, deathIndex: 1, birthUid: 55 }, [{ register: 4, kind: "hard-register" }]),
    pseudo(126, "a0", "local", { block: 1, birthIndex: 2, deathIndex: 4, birthUid: 103, deathUid: 105 }, [{ register: 127, kind: "pseudo" }]),
    pseudo(127, "v1", "local", { block: 1, birthIndex: 3, deathIndex: 4, birthUid: 112, deathUid: 105 }, [
      { register: 4, kind: "hard-register" }, { register: 126, kind: "pseudo" },
    ]),
  ];
  const trace = {
    schemaVersion: 2,
    function: "fixture",
    source: "fixture.c",
    reportArtifact: "report.json",
    pseudos,
    allocationOrder: [],
  } as CompilerTraceReport;
  const targetSchedule = {
    registerRoles: [
      { targetRegister: "a0", candidateRegister: "a3", targetIndexes: [0], candidateIndexes: [0], pseudos: [105, 999], confidence: "inferred", evidence: [] },
      { targetRegister: "a0", candidateRegister: "v1", targetIndexes: [1], candidateIndexes: [1], pseudos: [127, 999], confidence: "inferred", evidence: [] },
    ],
    target: [
      { index: 0, canonical: "li a0,1", mnemonic: "li", operands: ["a0", "1"] },
      { index: 1, canonical: "li a0,3", mnemonic: "li", operands: ["a0", "3"] },
    ],
    candidate: [
      { index: 0, canonical: "li a3,1", mnemonic: "li", operands: ["a3", "1"], uid: 55 },
      { index: 1, canonical: "li v1,3", mnemonic: "li", operands: ["v1", "3"], uid: 112 },
    ],
    correspondence: [
      { targetIndex: 0, candidateIndex: 0, confidence: "reconstructed", evidence: [] },
      { targetIndex: 1, candidateIndex: 1, confidence: "reconstructed", evidence: [] },
    ],
  } as TargetScheduleAnalysis;
  const result = analyzeAllocatorCounterfactual({
    functionName: "fixture",
    trace,
    targetSchedule,
    targetScheduleArtifact: "target.json",
    outputDirectory: "build/fixture",
    lregContent: lreg,
    lregInstructions: parseRtlInstructions(lreg, "lreg"),
  });
  assert.deepEqual(result.roles[0]!.pseudos, [105]);
  assert.equal(result.roles[0]!.findings[0]!.verdict, "requires-hard-lifetime-change");
  assert.deepEqual(result.roles[0]!.findings[0]!.explicitHardBlockers[0]!.requiredRelation, { beforeUid: 4, afterUid: 55 });
  assert.deepEqual(result.roles[1]!.pseudos, [127]);
  assert.equal(result.roles[1]!.findings[0]!.verdict, "requires-local-allocation-change");
  assert.equal(result.roles[1]!.findings[0]!.allocatedPseudoBlockers[0]!.pseudo, 126);
});
