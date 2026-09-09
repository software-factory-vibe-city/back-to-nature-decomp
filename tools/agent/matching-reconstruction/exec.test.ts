import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeFunction } from "./decode.js";
import { UnsupportedTarget, canon, executeFunction } from "./exec.js";
import { assemble, type AsmLine } from "./fixture-asm.js";

const run = (lines: AsmLine[], base = 0x80100000) =>
  executeFunction(decodeFunction(assemble(lines, base)));

test("a straight-line constant return is a single leaf", () => {
  const result = run([
    ["addiu", "v0", "zero", 5],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  assert.equal(node.kind === "leaf" && canon(node.value), "#5");
});

test("a delay slot executes regardless of the branch outcome", () => {
  /* The masking of a0 sits in the branch's delay slot; both leaves must see
   * the masked value even though they return different expressions. */
  const result = run([
    ["lui", "v0", 0x8007],
    ["lh", "v1", 0x1000, "v0"],
    ["bne", "v1", "zero", "out"],
    ["andi", "a0", "a0", 0xffff],
    ["addu", "v0", "a0", "zero"],
    ["jr", "ra"],
    ["nop"],
    ["label", "out"],
    ["addiu", "v0", "a0", 1],
    ["jr", "ra"],
    ["nop"],
  ]);
  const root = result.arena.node(result.root);
  assert.equal(root.kind, "test");
  if (root.kind === "test") {
    for (const ref of [root.onTrue, root.onFalse]) {
      const leaf = result.arena.node(ref);
      assert.equal(leaf.kind, "leaf");
      if (leaf.kind === "leaf") assert.ok(canon(leaf.value).includes("zext16(@a0)"), canon(leaf.value));
    }
  }
});

test("identical continuations merge instead of forking", () => {
  /* Both sides of the branch return the same constant; the collapsed DAG is a
   * single leaf because test() folds equal children. */
  const result = run([
    ["lui", "v0", 0x8007],
    ["lh", "v1", 0, "v0"],
    ["bne", "v1", "zero", "out"],
    ["nop"],
    ["label", "out"],
    ["addiu", "v0", "zero", 3],
    ["jr", "ra"],
    ["nop"],
  ]);
  assert.equal(result.arena.node(result.root).kind, "leaf");
});

test("a computed load address is an explicit unsupported case", () => {
  /* A scaled index is outside the pointer-base model; a plain argument
   * pointer, by contrast, is supported. */
  assert.throws(
    () => run([
      ["sll", "v1", "a1", 2],
      ["addu", "v1", "a0", "v1"],
      ["lw", "v0", 0, "v1"],
      ["jr", "ra"],
      ["nop"],
    ]),
    (error: unknown) => error instanceof UnsupportedTarget && /computed address/.test(error.reason),
  );
});

test("a load through an argument pointer is a based atom", () => {
  const result = run([
    ["lw", "v0", 4, "a0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && canon(node.value), "M4s[@a0+4]");
});

test("calls are rejected up front with their locations", () => {
  assert.throws(
    () => run([
      ["jal", 0x80020000],
      ["nop"],
      ["jr", "ra"],
      ["nop"],
    ]),
    (error: unknown) =>
      error instanceof UnsupportedTarget && /call-free/.test(error.reason) && error.vram.length === 1,
  );
});

test("a store through an argument pointer lands on the leaf with its base", () => {
  const result = run([
    ["sh", "a1", 2, "a0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(node.effects.length, 1);
    assert.equal(node.effects[0]!.address, 2);
    assert.equal(node.effects[0]!.base && canon(node.effects[0]!.base), "@a0");
  }
});

test("a store through one base forgets forwarded values under other bases", () => {
  /* After `*a1 = x`, the earlier read of `a0->unk0` may be stale; the second
   * read must be a fresh atom (epoch-tagged), not the first one again. */
  const result = run([
    ["lw", "v0", 0, "a0"],
    ["sw", "a2", 0, "a1"],
    ["lw", "v1", 0, "a0"],
    ["subu", "v0", "v1", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && canon(node.value), "sub(M4s[@a0+0]@1,M4s[@a0+0])");
});

test("stores land on the leaf in machine order, with forwarding to later loads", () => {
  const result = run([
    ["lui", "t2", 0x8007],
    ["addiu", "v0", "zero", 7],
    ["sh", "v0", 0x1000, "t2"],
    ["sw", "a0", 0x1004, "t2"],
    ["lh", "v1", 0x1000, "t2"],
    ["jr", "ra"],
    ["addu", "v0", "v1", "zero"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(node.effects.length, 2);
    assert.deepEqual(node.effects.map((effect) => [effect.address, effect.width]), [
      [0x80071000, 2],
      [0x80071004, 4],
    ]);
    assert.equal(canon(node.effects[1]!.value), "@a0");
    /* The load after the store sees the stored 7, sign-narrowed. */
    assert.equal(canon(node.value), "#7");
  }
});

test("a partial overlap between store sizes is refused, not guessed", () => {
  assert.throws(
    () => run([
      ["lui", "t2", 0x8007],
      ["sw", "a0", 0x1000, "t2"],
      ["sh", "a1", 0x1002, "t2"],
      ["jr", "ra"],
      ["nop"],
    ]),
    (error: unknown) => error instanceof UnsupportedTarget && /partially overlaps/.test(error.reason),
  );
});

test("a cycle with unchanged live state is reported, not explored forever", () => {
  assert.throws(
    () => run([
      ["label", "spin"],
      ["j", "spin"],
      ["nop"],
    ]),
    (error: unknown) => error instanceof UnsupportedTarget && /cycle|terminate/.test(error.reason),
  );
});

test("a concrete loop bound unrolls without forking", () => {
  /* Sums nothing, loops 4 times on a concrete counter, returns 7. */
  const result = run([
    ["addu", "t0", "zero", "zero"],
    ["label", "loop"],
    ["addiu", "t0", "t0", 1],
    ["slti", "v0", "t0", 4],
    ["bne", "v0", "zero", "loop"],
    ["nop"],
    ["addiu", "v0", "zero", 7],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && canon(node.value), "#7");
});

test("dead stale registers do not block state merging", () => {
  /* v0 holds a different stale load on each path into `next`, but it is dead
   * there; a scan of N records must stay linear in N, not 2^N. The 12-record
   * two-field scan below finishes well inside the state budget. */
  const lines: AsmLine[] = [
    ["addu", "t1", "zero", "zero"],
    ["lui", "t2", 0x8007],
    ["addiu", "t2", "t2", 0x1000],
    ["andi", "t4", "a0", 0xffff],
    ["label", "loop"],
    ["lh", "v0", 0, "t2"],
    ["bne", "v0", "zero", "next"],
    ["nop"],
    ["lh", "v0", 2, "t2"],
    ["bne", "v0", "t4", "next"],
    ["nop"],
    ["addiu", "v0", "zero", 1],
    ["jr", "ra"],
    ["nop"],
    ["label", "next"],
    ["addiu", "t1", "t1", 1],
    ["slti", "v0", "t1", 12],
    ["bne", "v0", "zero", "loop"],
    ["addiu", "t2", "t2", 8],
    ["addu", "v0", "zero", "zero"],
    ["jr", "ra"],
    ["nop"],
  ];
  const result = run(lines);
  assert.ok(result.states < 200, `expected linear state growth, saw ${result.states}`);
  assert.equal(result.loads.length, 24);
});
