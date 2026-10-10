import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { classifyJumpPair, jumpTraceFromDumps, renderJumpTrace } from "./jumpTrace.js";

const fixtures = join(import.meta.dirname, "../../test-fixtures/branch-orientation");
const fn = "ovl_11_func_8011E090";
const dump = (name: string, stage: string) => readFileSync(join(fixtures, `${name}.${stage}`), "utf8");

test("preserved nested tail: the flag SET moves before UID 241 and reverses its test", () => {
  const changes = classifyJumpPair(dump("t1", "rtl"), dump("t1", "jump"), fn);
  assert.equal(changes.find(c => c.uid === 233)?.classification, "unchanged");
  const flag = changes.find(c => c.uid === 241)!;
  assert.equal(flag.classification, "assignment-hoist");
  assert.equal(flag.rule, "jump.c:596");
  assert.equal(flag.resultRegister, 2);
  assert.match(flag.evidence.join("\n"), /moved before UID 241.*ne -> eq/);
});
test("preserved separate returns: Boolean fold is witnessed, its intermediate hoist is not", () => {
  const changes = classifyJumpPair(dump("t5", "rtl"), dump("t5", "jump"), fn);
  const flag = changes.find(c => c.uid === 249)!;
  assert.equal(flag.classification, "store-flag-fold");
  assert.equal(flag.rule, "jump.c:870/:1021");
  assert.match(flag.evidence.join("\n"), /not observable/);
});
test("committed tail: both tail tests remain unchanged, including aliased exit labels", () => {
  const changes = classifyJumpPair(dump("final", "rtl"), dump("final", "jump"), fn);
  assert.deepEqual(changes.slice(-2).map(c => [c.uid, c.classification]), [[232, "unchanged"], [240, "unchanged"]]);
});
test("else hoist must move the SET before the whole chain and redirect its exits", () => {
  const conditional = (uid: number, label: number, operand: number) => `(jump_insn ${uid} 0 0 (set (pc) (if_then_else (eq:SI (reg:SI ${operand}) (const_int 0)) (label_ref ${label}) (pc))) 0 (nil) (nil))`;
  const set = (uid: number, n: number) => `(insn ${uid} 0 0 (set (reg:SI 80) (const_int ${n})) 0 (nil) (nil))`;
  const go = (uid: number, label: number) => `(jump_insn ${uid} 0 0 (set (pc) (label_ref ${label})) 0 (nil) (nil))`;
  const label = (uid: number) => `(code_label ${uid} 0 0 0 "")`;
  const before = `;; Function fixture\n${[conditional(10, 20, 90), conditional(11, 20, 91), set(12, 1), go(13, 30), label(20), set(21, 0), label(30), set(31, 7)].join("\n")}`;
  const after = `;; Function fixture\n${[set(40, 0), conditional(10, 30, 90), conditional(11, 30, 91), set(12, 1), label(30), set(31, 7)].join("\n")}`;
  assert.deepEqual(classifyJumpPair(before, after, "fixture").map(c => c.classification), ["else-hoist", "else-hoist"]);
  const wrong = after.replace("(const_int 0)) 0", "(const_int 9)) 0");
  assert.ok(classifyJumpPair(before, wrong, "fixture").every(c => c.classification === "undetermined"));
});

test("unmatched or changed operand pairs are undetermined; other functions do not contaminate attribution", () => {
  const before = dump("t1", "rtl"), after = dump("t1", "jump");
  assert.equal(classifyJumpPair(before, before, fn).find(c => c.uid === 241)?.classification, "unchanged");
  const changed = after.replace(/\(reg:SI 159\)/g, "(reg:SI 999)");
  assert.equal(classifyJumpPair(before, changed, fn).find(c => c.uid === 241)?.classification, "undetermined");
  assert.throws(() => classifyJumpPair(before + before, after, fn), /expected one RTL section/);
  const report = jumpTraceFromDumps(fn, { rtl: before, jump: after, cse: after });
  assert.equal(report.passes.length, 2);
  assert.match(renderJumpTrace(report), /reg_set_last stops at a label/);
  assert.match(renderJumpTrace(report), /do not uniquely attribute a pass/);
});
