import { strict as assert } from "node:assert";
import { test } from "node:test";
import { liftWords } from "./pipeline-reversal/lift.js";
import { branchOrientations, attachJumpAttribution } from "./branch-orientation.js";
import { jumpTraceFromDumps } from "./jumpTrace.js";

function machine(lines: string[]) {
  return liftWords({ functionName: "fixture", words: lines.map((text, i) => ({ vram: 0x1000 + 4 * i, raw: 0, text, key: text })) });
}
const branch = (sense = "bnez", temporary = "v1", bit = 8) => machine([
  `lw ${temporary},0x0(a0)`, `andi ${temporary},${temporary},${bit}`, `${sense} ${temporary},0x1014`,
  sense === "bnez" ? "move v0,zero" : "li v0,1", sense === "bnez" ? "li v0,1" : "move v0,zero", "jr ra", "nop",
]);

test("opposite sense plus swapped delay/fall constants is a located orientation, in both directions", () => {
  assert.equal(branchOrientations(branch(), branch("beqz"))[0]?.kind, "opposite-sense");
  assert.equal(branchOrientations(branch("beqz"), branch())[0]?.kind, "opposite-sense");
  assert.deepEqual(branchOrientations(branch(), branch("bnez", "t0")), []);
  assert.deepEqual(branchOrientations(branch(), branch("beqz", "v1", 16)), []);
  assert.deepEqual(branchOrientations(branch(), branch("beqz"), new Set([10])), []);
});
test("Boolean storeflag must compare the same value AND compute the same polarity", () => {
  const flag = machine(["lw v1,0x0(a0)", "andi v1,v1,8", "sltiu v0,v1,0x1", "jr ra", "nop"]);
  assert.equal(branchOrientations(branch(), flag)[0]?.kind, "branch-to-flag");
  assert.equal(branchOrientations(flag, branch())[0]?.kind, "flag-to-branch");
  const wrong = machine(["lw v1,0x0(a0)", "andi v1,v1,8", "sltu v0,zero,v1", "jr ra", "nop"]);
  assert.deepEqual(branchOrientations(branch(), wrong), []);
  const xor = machine(["lw v1,0x0(a0)", "andi v1,v1,8", "sltu v0,zero,v1", "xori v0,v0,1", "jr ra", "nop"]);
  assert.equal(branchOrientations(branch(), xor).length, 1);
  const clobbered = machine(["lw v1,0x0(a0)", "andi v1,v1,8", "sltiu v0,v1,0x1", "li v0,7", "jr ra", "nop"]);
  assert.deepEqual(branchOrientations(branch(), clobbered), []);
});
test("unknown producer and different exit/effect paths are not orientation witnesses", () => {
  const unknown = machine(["mystery v1", "bnez v1,0x1010", "move v0,zero", "li v0,1", "jr ra", "nop"]);
  const other = machine(["mystery v1", "beqz v1,0x1010", "li v0,1", "move v0,zero", "jr ra", "nop"]);
  assert.deepEqual(branchOrientations(unknown, other), []);
  const effect = machine(["lw v1,0x0(a0)", "andi v1,v1,8", "beqz v1,0x1018", "li v0,1", "move v0,zero", "sw v0,0x0(a0)", "jr ra", "nop"]);
  assert.deepEqual(branchOrientations(branch(), effect), []);
});
test("another return-register hoist is not a machine-to-dump binding", () => {
  const findings = branchOrientations(branch(), branch("beqz"));
  const trace = jumpTraceFromDumps("fixture", {});
  trace.passes = [{ before: "rtl", after: "jump", changes: [{ uid: 7, classification: "assignment-hoist", rule: "jump.c:596", resultRegister: 2, condition: "x", before: "x", evidence: [] }] }];
  attachJumpAttribution(findings, trace);
  assert.equal(findings[0]?.attribution, undefined);
  trace.passes[0]!.changes[0]!.machineComparison = findings[0]!.candidateComparison!;
  const rebound = branchOrientations(branch(), branch("beqz"));
  attachJumpAttribution(rebound, trace);
  assert.equal(rebound[0]?.attribution?.uid, 7);
});
