import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeFunction } from "./decode.js";
import { UnsupportedTarget, canon, computeLiveIn, executeFunction } from "./exec.js";
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

test("a computed load address with a single index term is now supported (D3: scaled indexing)", () => {
  /* sll(a1, 2) + a0 — a single scaled index with an argument pointer base.
   * D3 supports this as an indexed address: base a0, index a1, scale 4. */
  const result = run([
    ["sll", "v1", "a1", 2],
    ["addu", "v1", "a0", "v1"],
    ["lw", "v0", 0, "v1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.ok(canon(node.value).includes("[@a1*4]"), `expected [@a1*4] in ${canon(node.value)}`);
  }
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

test("calls are recorded as opaque call effects with clobbers (D6)", () => {
  const result = run([
    ["jal", 0x80020000],
    ["nop"],
    ["addiu", "v0", "zero", 7],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(node.effects.length, 1);
    assert.equal(node.effects[0]!.kind, "call");
    const call = node.effects[0] as { kind: "call"; callee: string; seq: number; args: unknown[] };
    assert.equal(call.callee, "0x80020000");
    /* After the call the function runs again and returns 7: the call was
     * opaque (inline) — execution continued past it. */
    assert.equal(canon(node.value), "#7");
  }
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
    const effect = node.effects[0]!;
    assert.equal(effect.kind, "store");
    if (effect.kind === "store") {
      assert.equal(effect.address, 2);
      assert.equal(effect.base && canon(effect.base), "@a0");
    }
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
    const stores = node.effects.filter((effect) => effect.kind === "store");
    assert.deepEqual(stores.map((effect) => [effect.address, effect.width]), [
      [0x80071000, 2],
      [0x80071004, 4],
    ]);
    assert.equal(canon(stores[1]!.value), "@a0");
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

/* ---- D1: multiply, divide, hi/lo ----------------------------------------- */

test("mult + mflo produces mulLo leaf", () => {
  const result = run([
    ["mult", "a0", "a1"],
    ["mflo", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(canon(node.value), "mulLo(@a0,@a1)");
  }
});

test("div + mfhi produces remS leaf (remainder)", () => {
  const result = run([
    ["div", "a0", "a1"],
    ["mfhi", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(canon(node.value), "remS(@a0,@a1)");
  }
});

test("constant folding: 7 * 6 = 42", () => {
  const result = run([
    ["addiu", "a0", "zero", 7],
    ["addiu", "a1", "zero", 6],
    ["mult", "a0", "a1"],
    ["mflo", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && canon(node.value), "#42");
});

test("constant folding: -7 / 2 = -3 (truncation toward zero)", () => {
  const result = run([
    ["addiu", "a0", "zero", -7],
    ["addiu", "a1", "zero", 2],
    ["div", "a0", "a1"],
    ["mflo", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  /* constExpr stores unsigned: -3 as u32 is 0xFFFFFFFD */
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && node.value.kind === "const" && (node.value.value | 0), -3);
});

test("constant folding: -7 % 2 = -1", () => {
  const result = run([
    ["addiu", "a0", "zero", -7],
    ["addiu", "a1", "zero", 2],
    ["div", "a0", "a1"],
    ["mfhi", "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  /* constExpr stores unsigned: -1 as u32 is 0xFFFFFFFF */
  const node = result.arena.node(result.root);
  assert.equal(node.kind === "leaf" && node.value.kind === "const" && (node.value.value | 0), -1);
});

test("div by constant zero throws UnsupportedTarget", () => {
  assert.throws(
    () => run([
      ["addiu", "a0", "zero", 5],
      ["addiu", "a1", "zero", 0],
      ["div", "a0", "a1"],
      ["mflo", "v0"],
      ["jr", "ra"],
      ["nop"],
    ]),
    (error: unknown) => error instanceof UnsupportedTarget && /division by constant zero/.test(error.reason),
  );
});

test("straight-line effect: store arg0 * arg1 via mulLo + mflo", () => {
  const result = run([
    ["mult", "a0", "a1"],
    ["mflo", "t0"],
    ["lui", "t1", 0x8007],
    ["sw", "t0", 0x1000, "t1"],
    ["lw", "v0", 0x1000, "t1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.equal(node.effects.length, 1);
    const effect = node.effects[0]!;
    assert.equal(effect.kind, "store");
    assert.equal(effect.kind === "store" && canon(effect.value), "mulLo(@a0,@a1)");
    /* The re-load after the store forwards the stored value. */
    assert.equal(canon(node.value), "mulLo(@a0,@a1)");
  }
});

test("liveness includes hi/lo after mult", () => {
  /* After `mult a0, a1` (index 0), hi and lo are defined. The mflo at index 1
   * reads lo, and jr reads v0 + ra. So the live-in at mflo should include lo
   * in the hi/lo word (bit 1), and the live-in at mult should NOT have hi/lo
   * since mult is what defines them (they are not live-before mult). */
  const lines: AsmLine[] = [
    ["mult", "a0", "a1"],
    ["mflo", "v0"],
    ["jr", "ra"],
    ["nop"],
  ];
  const words = assemble(lines, 0x80100000);
  const decoded = decodeFunction(words);
  const liveIn = computeLiveIn(decoded);
  /* After mult defines hi/lo, mflo at index 1 reads lo. Check live-in at mflo. */
  const mfloLiveWord1 = liveIn[1 * 2 + 1]!;
  /* LO_BIT = 1 << (33 - 32) = 2 = 0b10 */
  assert.ok((mfloLiveWord1 & 2) !== 0, "lo is live at mflo (bit 1 of second word)");
  /* HI_BIT = 1 << (32 - 32) = 1. hi is NOT live at mflo because mflo only reads lo. */
  assert.equal((mfloLiveWord1 & 1), 0, "hi is not live at mflo");
  /* At the mult (index 0), hi/lo are NOT live before mult (they are def'd by it). */
  const multLiveWord1 = liveIn[0 * 2 + 1]!;
  assert.equal((multLiveWord1 & 1), 0, "hi is not live before mult");
  assert.equal((multLiveWord1 & 2), 0, "lo is not live before mult");
});

test("a computed load address with a single index term is now supported (D3: scaled indexing)", () => {
  /* sll(a1, 2) + a0 — a single scaled index with an argument pointer base.
   * D3 supports this as an indexed address: base a0, index a1, scale 4. */
  const result = run([
    ["sll", "v1", "a1", 2],
    ["addu", "v1", "a0", "v1"],
    ["lw", "v0", 0, "v1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    assert.ok(canon(node.value).includes("[@a1*4]"), `expected [@a1*4] in ${canon(node.value)}`);
  }
});

test("indexed store through argument pointer lands on the leaf (D3)", () => {
  /* sw a2, 0(v1) where v1 = a0 + sll(a1, 2). This is an indexed store. */
  const result = run([
    ["sll", "v1", "a1", 2],
    ["addu", "v1", "a0", "v1"],
    ["sw", "a2", 0, "v1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "leaf");
  if (node.kind === "leaf") {
    /* The store effect on the leaf should carry the indexed address. */
    const effects = node.effects;
    assert.ok(effects.length >= 1, "expected at least one effect");
    const effect = effects[0]!;
    assert.equal(effect.kind, "store");
    if (effect.kind === "store") {
      assert.ok(effect.index !== undefined, "expected effect.index to be set");
      assert.equal(effect.index!.scale, 4, "expected scale 4");
    }
  }
});

test("jump-table dispatch via loaded word forms a dispatch DAG node (D4)", () => {
  const tableAddr = 0x800100DC;
  const functionStart = 0x80100000;
  /* The function loads a table entry at tableAddr + a0*4, then dispatches
   * through v0. Two case bodies follow after the jr+nop sequence. */
  const insns = decodeFunction(assemble([
    ["lui", "v0", tableAddr >>> 16],
    ["addiu", "v0", "v0", tableAddr & 0xFFFF],
    ["sll", "v1", "a0", 2],
    ["addu", "v1", "v1", "v0"],
    ["lw", "v0", 0, "v1"],
    ["jr", "v0"],
    ["nop"],
    /* case 0 at index 7 (0x8010001C) */
    ["addiu", "v0", "zero", 100],
    ["jr", "ra"],
    ["nop"],
    /* case 1 at index 10 (0x80100028) */
    ["addiu", "v0", "zero", 200],
    ["jr", "ra"],
    ["nop"],
  ], functionStart));

  const result = executeFunction(insns, {
    readWord: (vram: number): number | undefined => {
      if (vram === tableAddr) return functionStart + 7 * 4;     /* case 0 */
      if (vram === tableAddr + 4) return functionStart + 10 * 4; /* case 1 */
      return undefined;
    },
  });

  const node = result.arena.node(result.root);
  assert.equal(node.kind, "dispatch");
  if (node.kind === "dispatch") {
    assert.equal(node.targets.length, 2, "expected 2 dispatch targets");
    const target0 = result.arena.node(node.targets[0]!);
    const target1 = result.arena.node(node.targets[1]!);
    assert.equal(target0.kind, "leaf");
    assert.equal(target1.kind, "leaf");
    if (target0.kind === "leaf" && target1.kind === "leaf") {
      assert.equal(canon(target0.value), "#100");
      assert.equal(canon(target1.value), "#200");
    }
  }
});

test("dispatch with bounds check merges into switch-default (D4)", () => {
  /* A sltiu test precedes the dispatch; the guard's true arm is the dispatch
   * and the false arm is a leaf returning -1. The constructor (guarded class)
   * should merge these into a switch with a default case. */
  const tableAddr = 0x800100DC;
  const functionStart = 0x80100000;
  /* slti a0, 2 (a0 < 2) -> v1, beq -> default on a0 >= 2, fall through to dispatch */
  const insns = decodeFunction(assemble([
    ["slti", "v1", "a0", 2],
    ["beq", "v1", "zero", "default"],
    ["nop"],
    ["lui", "v0", tableAddr >>> 16],
    ["addiu", "v0", "v0", tableAddr & 0xFFFF],
    ["sll", "v1", "a0", 2],
    ["addu", "v1", "v1", "v0"],
    ["lw", "v0", 0, "v1"],
    ["jr", "v0"],
    ["nop"],
    ["addiu", "v0", "zero", 10],
    ["jr", "ra"],
    ["nop"],
    ["addiu", "v0", "zero", 20],
    ["jr", "ra"],
    ["nop"],
    ["label", "default"],
    ["addiu", "v0", "zero", -1],
    ["jr", "ra"],
    ["nop"],
  ], functionStart));

  const result = executeFunction(insns, {
    readWord: (vram: number): number | undefined => {
      if (vram === tableAddr) return functionStart + 10 * 4; /* case 0 at index 10 */
      if (vram === tableAddr + 4) return functionStart + 13 * 4; /* case 1 at index 13 */
      return undefined;
    },
  });

  /* The executor keeps the bounds check as a test above the dispatch; the
   * guarded constructor merges them into a switch-with-default at emission. */
  const node = result.arena.node(result.root);
  assert.equal(node.kind, "test");
  if (node.kind === "test") {
    assert.equal(node.pred.op, "ltS");
    assert.equal(canon(node.pred.left), "@a0");
    const onTrue = result.arena.node(node.onTrue);
    assert.equal(onTrue.kind, "dispatch");
    if (onTrue.kind === "dispatch") {
      assert.equal(onTrue.targets.length, 2);
      assert.equal(canon(onTrue.index), "@a0");
    }
  }
});
