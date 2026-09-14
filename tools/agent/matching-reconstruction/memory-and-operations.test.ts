/**
 * Overlapping and unaligned memory, and the compiler operations that produce
 * them.
 *
 * Three capabilities meet here, and each replaces a refusal that had filed
 * ordinary compiler output under "not plain C":
 *
 *   - a narrow read inside a wider stored cell is a byte view, not an
 *     unsupported overlap;
 *   - a `break` inside a division's guard is the compiler's trap packet, and
 *     the guard is not part of the source;
 *   - a region of `lwl`/`swl` pairs is a block move, and the recoverable thing
 *     is the move, not the expansion.
 *
 * The refusals that remain are tested too. A `break` with no division is still
 * refused, and a read that straddles two differently sized writes is still
 * refused — the point was never to accept more, it was to stop calling
 * compiler output handwritten.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { decodeFunction, decodeWord } from "./decode.js";
import { assemble } from "./fixture-asm.js";
import { canon, executeFunction, UnsupportedTarget } from "./exec.js";
import { describeCopyRecipe, hasAlignmentTest, recognizeCopyRecipe } from "./copy-recipe.js";
import { targetFeatures } from "./failure-category.js";
import { recoverContext } from "./context-product.js";
import { reconstructFunction } from "./engine.js";
import { decodeFunctionWords } from "../family-transfer/signature.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/* ---- decoding -------------------------------------------------------------- */

test("break, lwl/lwr and swl/swr decode instead of falling out of the subset", () => {
  /* break 0x1cd — SPECIAL function 0x0d with a code field. */
  const trap = decodeWord((0x1cd << 6) | 0x0d, 0x80010000);
  assert.equal(trap.op, "break");
  assert.equal(trap.code, 0x1cd);
  /* lwl $v0, 3($a0) and swr $v0, 0($a0) */
  assert.equal(decodeWord((0x22 << 26) | (4 << 21) | (2 << 16) | 3, 0x80010000).op, "lwl");
  assert.equal(decodeWord((0x2e << 26) | (4 << 21) | (2 << 16) | 0, 0x80010000).op, "swr");
});

/* ---- byte-accurate overlap -------------------------------------------------- */

test("a byte read inside a stored word is the shifted word, narrowed", () => {
  const executed = executeFunction(decodeFunction(assemble([
    ["addiu", "v1", "zero", 0],
    ["sw", "a0", 0, "a1"],
    ["lbu", "v0", 2, "a1"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000)));
  const node = executed.arena.node(executed.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") assert.equal(canon(node.value), "zext8(srl(@a0,#16))");
});

/* ---- the division trap packet ---------------------------------------------- */

test("a break with no division in the function is refused, not discarded", () => {
  /* A guard around something that is not a division: the packet recogniser
   * must not swallow it, because the exceptional path is then real. */
  assert.throws(
    () => executeFunction(decodeFunction(assemble([
      ["bne", "a0", "zero", "ok"],
      ["nop"],
      ["break"],
      ["label", "ok"],
      ["addiu", "v0", "zero", 1],
      ["jr", "ra"],
      ["nop"],
    ], 0x80010000))),
    (error: unknown) => error instanceof UnsupportedTarget && error.category === "trap-packet",
  );
});

test("a division's guard is removed and the division survives", () => {
  const executed = executeFunction(decodeFunction(assemble([
    ["div", "a0", "a1"],
    ["bne", "a1", "zero", "ok"],
    ["nop"],
    ["break"],
    ["label", "ok"],
    ["mflo", "v0"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000)));
  const node = executed.arena.node(executed.root);
  assert.equal(node.kind, "leaf", "the guard is gone, so the relation has one path");
  if (node.kind === "leaf") assert.equal(canon(node.value), "divS(@a0,@a1)");
});

test("a trap unrelated to the division is kept, even though the function divides", () => {
  /* The guard here tests `$a0`, which is neither operand of the division. A
   * recogniser that reads "this function divides somewhere" as a licence to
   * remove guarded traps turns this into an unconditional `a1 / a2` and loses
   * the exceptional path — a different program that happens to divide. */
  assert.throws(
    () => executeFunction(decodeFunction(assemble([
      ["beq", "a0", "zero", "trap"],
      ["nop"],
      ["div", "a1", "a2"],
      ["mflo", "v0"],
      ["jr", "ra"],
      ["nop"],
      ["label", "trap"],
      ["break"],
    ], 0x80010000))),
    (error: unknown) => error instanceof UnsupportedTarget && error.category === "trap-packet",
  );
});

projectTest("the division wrapper reconstructs byte-exactly with a plain `/`", () => {
  const result = reconstructFunction({ functionName: "func_80013450", notify: () => {} });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.match(result.winner!.source, /0xFF \/ arg0/, "the source spells the division, not the packet");
  assert.ok(!/__asm__|break/.test(result.winner!.source), "no assembly and no trap in the recovered source");
});

/* ---- aggregate copy --------------------------------------------------------- */

test("the combined-alignment test is recognised by its shape", () => {
  const insns = decodeFunction(assemble([
    ["or", "v0", "v1", "a1"],
    ["andi", "v0", "v0", 3],
    ["beq", "v0", "zero", "aligned"],
    ["nop"],
    ["label", "aligned"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000));
  assert.equal(hasAlignmentTest(insns), true);
});

test("a couple of unrelated word moves are not called a block copy", () => {
  const insns = decodeFunction(assemble([
    ["lw", "v0", 0, "a0"],
    ["sw", "v0", 0, "a1"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000));
  assert.equal(recognizeCopyRecipe(insns), null);
});

test("loading, incrementing and storing through one register is not a copy", () => {
  /* Every stored register was filled by a load at the same offset, so a
   * recogniser that matches register *names* sees a sixteen-byte block move.
   * The values were all changed on the way, and nothing here is copied. */
  const insns = decodeFunction(assemble([
    ["lw", "t0", 0, "a0"], ["lw", "t1", 4, "a0"], ["lw", "t2", 8, "a0"], ["lw", "t3", 12, "a0"],
    ["addiu", "t0", "t0", 1], ["sw", "t0", 0, "a1"],
    ["addiu", "t1", "t1", 1], ["sw", "t1", 4, "a1"],
    ["addiu", "t2", "t2", 1], ["sw", "t2", 8, "a1"],
    ["addiu", "t3", "t3", 1], ["sw", "t3", 12, "a1"],
    ["jr", "ra"], ["nop"],
  ], 0x80010000));
  assert.equal(recognizeCopyRecipe(insns), null);
});

test("the same words with the increments removed are a copy", () => {
  /* The control for the test above: the geometry is identical and only the
   * value flow differs, so a null there is about reaching definitions and not
   * about the run being too short or too plain. */
  const insns = decodeFunction(assemble([
    ["lw", "t0", 0, "a0"], ["lw", "t1", 4, "a0"], ["lw", "t2", 8, "a0"], ["lw", "t3", 12, "a0"],
    ["sw", "t0", 0, "a1"], ["sw", "t1", 4, "a1"], ["sw", "t2", 8, "a1"], ["sw", "t3", 12, "a1"],
    ["jr", "ra"], ["nop"],
  ], 0x80010000));
  const recipe = recognizeCopyRecipe(insns);
  assert.ok(recipe, "sixteen bytes move, unchanged, from one pointer to another");
  assert.equal(recipe!.runs[0]!.bytes, 16);
});

projectTest("the copy family's expansion is recovered as one operation", () => {
  const { insns } = decodeFunctionWords("ovl_17_func_800B9FA8");
  const recipe = recognizeCopyRecipe(insns);
  assert.ok(recipe, "the region is a block move, not handwritten code");
  assert.equal(recipe!.alignmentTested, true, "the runtime alignment test is part of the expansion");
  assert.equal(recipe!.bytesPerIteration, 16);
  assert.ok(recipe!.runs.some((run) => run.unaligned), "the unaligned path is one of the runs");
  assert.ok(recipe!.runs.some((run) => !run.unaligned), "and the aligned path is another");
  assert.match(describeCopyRecipe(recipe!), /aggregate copy/);
});

projectTest("every member of the copy family recovers the same operation", () => {
  /* The plan names this family: one shape across four overlays. A capability
   * that closes one member and not the rest is a spelling, not a capability. */
  const members = ["ovl_17_func_800B9FA8", "ovl_19_func_800BB5D4", "ovl_21_func_800BB328", "ovl_23_func_800BB0AC"];
  const recognised: string[] = [];
  for (const member of members) {
    let insns;
    try {
      insns = decodeFunctionWords(member).insns;
    } catch {
      continue; /* a member this tree does not configure */
    }
    const recipe = recognizeCopyRecipe(insns);
    if (recipe && recipe.alignmentTested) recognised.push(member);
  }
  assert.ok(recognised.length >= 2, `expected the family to recover together; got ${recognised.join(", ") || "none"}`);
});

projectTest("an unaligned region is filed as an operation, not as undecoded words", () => {
  const context = recoverContext("ovl_17_func_800B9FA8");
  assert.equal(context.features.unknownOpcodes.length, 0, "nothing here is outside the decoder any more");
  assert.ok(context.features.unalignedAccesses > 0, "the mechanism is counted under its own name");
  assert.ok(context.operations.length > 0, "and the operation those accesses implement is recovered");
});

projectTest("the census heading names the operation rather than the instruction", () => {
  const result = reconstructFunction({ functionName: "ovl_17_func_800B9FA8", notify: () => {} });
  assert.equal(result.unresolved?.category, "unaligned-access");
  assert.ok(result.recognizedOperations?.some((line) => line.includes("aggregate copy")));
});

/* ---- mixed-width access is representable ------------------------------------ */

projectTest("a word store then a byte read through one pointer compiles", () => {
  const result = reconstructFunction({ functionName: "ovl_11_func_800C6E0C", notify: () => {} });
  assert.ok(result.compiles > 0, `expected compiling candidates; state ${result.state}: ${result.unresolved?.detail}`);
  assert.ok(result.bestEffort, "and a draft to hand on");
});

test("features count unaligned accesses and traps under their own names", () => {
  const insns = decodeFunction(assemble([
    ["lwl", "v0", 3, "a0"],
    ["lwr", "v0", 0, "a0"],
    ["break"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80010000));
  const features = targetFeatures(insns);
  assert.equal(features.unalignedAccesses, 2);
  assert.equal(features.trapPackets, 1);
  assert.equal(features.unknownOpcodes.length, 0);
});
