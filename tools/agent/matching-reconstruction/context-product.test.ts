/**
 * The recovered-context product: interface and storage facts from the target's
 * own words, available whether or not construction produced any C.
 *
 * These run against the real project so the facts under test are real ones. A
 * function the executor refuses must still yield its parameters and the
 * globals it names — that independence is the whole point, and a unit test on
 * a synthetic buffer would not exercise it.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { calleePrototypes, recoverContext } from "./context-product.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

projectTest("a pointer parameter is proved from entry liveness and dereference", () => {
  /* ovl_11_func_800D5B3C reads two halfwords through $a0 and returns a value.
   * The executor refuses to construct it; the context must not care. */
  const context = recoverContext("ovl_11_func_800D5B3C");
  const a0 = context.parameters.find((parameter) => parameter.register === "a0");
  assert.ok(a0, "$a0 is live at entry, so it is a parameter");
  assert.equal(a0!.strength, "proved");
  assert.equal(a0!.usedAsPointerBase, true, "the body dereferences it");
  assert.deepEqual(a0!.fieldOffsets.slice().sort((left, right) => left - right), [0, 2]);
  assert.equal(context.returns.kind, "value");
});

projectTest("witnessed field geometry is recovered as a minimum extent, not a layout", () => {
  const context = recoverContext("ovl_11_func_800D5B3C");
  /* The function's final read is a halfword at +0xAC through a loaded
   * pointer — the literal the family transfer has to substitute. */
  const deep = context.objects.find((object) => object.minimumExtent >= 0xae);
  assert.ok(deep, "the 0xAC halfword read must appear as an object field");
  assert.equal(deep!.origin, "loaded-pointer");
  const field = deep!.fields.find((item) => item.offset === 0xac);
  assert.ok(field, "the witnessed offset is 0xAC");
  assert.equal(field!.width, 2);
  assert.equal(deep!.minimumExtent, 0xae, "extent is the highest witnessed byte, not a claimed size");
});

projectTest("a resolved callee keeps its parameter types, pointers included", () => {
  /* func_8001F190 calls CopyVec3(Vec3 *, Vec3 *). Dropping the star turns two
   * pointer parameters into two structure-by-value parameters. */
  const context = recoverContext("func_8001F190");
  const call = context.calls.find((item) => item.callee === "CopyVec3");
  assert.ok(call?.signature, "CopyVec3 has a matched definition");
  assert.equal(call!.signature!.arity, 2);
  assert.ok(
    call!.signature!.paramTypes.every((type) => type.includes("*")),
    `both parameters are pointers; got ${JSON.stringify(call!.signature!.paramTypes)}`,
  );
  assert.ok(calleePrototypes(context).some((line) => line.includes("CopyVec3") && line.includes("*")));
});

projectTest("an unresolved callee gets a bounded range, never a fabricated arity", () => {
  const context = recoverContext("func_8001F190");
  for (const call of context.calls) {
    if (call.signature) continue;
    assert.ok(
      call.range === undefined || call.range.arityLo <= call.range.arityHi,
      "an unresolved callee reports a range, not a single invented arity",
    );
  }
});

projectTest("context is produced for a function the executor refuses", () => {
  /* ovl_17_func_800B9FA8 is the 628-byte initialisation-and-copy routine: its
   * words contain `lwl`/`swl`, which the executor does not run. The context
   * product must still describe the interface, because none of that depends
   * on execution. */
  const context = recoverContext("ovl_17_func_800B9FA8");
  assert.ok(context.notes.some((note) => note.includes("refused")), "the refusal is recorded, not hidden");
  assert.ok(context.features.unalignedAccesses > 0, "the mechanism is named, not lumped into 'undecoded'");
  assert.ok(context.calls.length > 0, "jal targets are absolute and resolve without execution");
});

projectTest("a division trap packet no longer refuses the function", () => {
  /* The `break` in func_80013450 is the compiler's divide-by-zero guard. It is
   * modelled and its guard removed, so the function reaches construction. */
  const context = recoverContext("func_80013450");
  assert.equal(context.features.trapPackets > 0, true, "the break is counted as a trap packet");
  assert.ok(
    !context.notes.some((note) => note.includes("refused")),
    `the packet is recognised, not refused: ${context.notes.join("; ")}`,
  );
});
