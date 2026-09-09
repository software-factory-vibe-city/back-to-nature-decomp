import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeFunction } from "./decode.js";
import { executeFunction } from "./exec.js";
import { fitScanRelation } from "./scan-relation.js";
import { assemble, type AsmLine } from "./fixture-asm.js";
import type { ScanRelation } from "./types.js";

/* ---- parameterized synthetic scans (plan §6 C4 exit gate) ----------------- */

interface ScanParams {
  base: number;
  stride: number;
  count: number;
  fields: Array<{
    offset: number;
    load: "lb" | "lbu" | "lh" | "lhu" | "lw";
    rhs: { kind: "const"; value: number } | { kind: "arg-zext16" };
  }>;
  successValue: number | "index";
  failValue: number;
}

/** Emit a natural, unrotated scan loop for the given parameters. */
function scanFixture(params: ScanParams): AsmLine[] {
  const hi = (params.base + 0x8000) >>> 16;
  const lo = params.base & 0xffff;
  const lines: AsmLine[] = [
    ["addu", "t1", "zero", "zero"],
    ["lui", "t2", hi],
    ["addiu", "t2", "t2", lo >= 0x8000 ? lo - 0x10000 : lo],
  ];
  if (params.fields.some((field) => field.rhs.kind === "arg-zext16")) {
    lines.push(["andi", "t4", "a0", 0xffff]);
  }
  lines.push(["label", "loop"]);
  for (const field of params.fields) {
    lines.push([field.load, "v0", field.offset, "t2"]);
    if (field.rhs.kind === "arg-zext16") {
      lines.push(["bne", "v0", "t4", "next"], ["nop"]);
    } else if (field.rhs.value === 0) {
      lines.push(["bne", "v0", "zero", "next"], ["nop"]);
    } else {
      lines.push(["addiu", "t5", "zero", field.rhs.value], ["bne", "v0", "t5", "next"], ["nop"]);
    }
  }
  if (params.successValue === "index") {
    lines.push(["addu", "v0", "t1", "zero"]);
  } else {
    lines.push(["addiu", "v0", "zero", params.successValue]);
  }
  lines.push(["jr", "ra"], ["nop"]);
  lines.push(
    ["label", "next"],
    ["addiu", "t1", "t1", 1],
    ["slti", "v0", "t1", params.count],
    ["bne", "v0", "zero", "loop"],
    ["addiu", "t2", "t2", params.stride],
    ["addiu", "v0", "zero", params.failValue],
    ["jr", "ra"],
    ["nop"],
  );
  return lines;
}

function fitFixture(params: ScanParams): ScanRelation {
  const executed = executeFunction(decodeFunction(assemble(scanFixture(params), 0x80100000)));
  const fit = fitScanRelation(executed.arena, executed.root);
  assert.ok(fit.fitted, `expected a fit: ${fit.fitted ? "" : fit.reason}`);
  return fit.fitted ? fit.relation : (undefined as never);
}

test("the two-field halfword scan round-trips its parameters", () => {
  const relation = fitFixture({
    base: 0x80071000,
    stride: 12,
    count: 5,
    fields: [
      { offset: 0, load: "lh", rhs: { kind: "const", value: 0 } },
      { offset: 2, load: "lh", rhs: { kind: "arg-zext16" } },
    ],
    successValue: 1,
    failValue: 0,
  });
  assert.equal(relation.base, 0x80071000);
  assert.equal(relation.stride, 12);
  assert.equal(relation.count, 5);
  assert.deepEqual(relation.tests.map((test_) => [test_.offset, test_.width, test_.signed, test_.op]), [
    [0, 2, true, "eq"],
    [2, 2, true, "eq"],
  ]);
  const arg = relation.tests[1]!.rhs;
  assert.ok(arg.kind === "arg" && arg.use.register === "a0" && arg.use.conversion === "zext16");
  assert.deepEqual(relation.successReturn, { kind: "const", value: 1 });
  assert.equal(relation.failReturn, 0);
});

test("counts, strides, offsets, widths and signedness all vary", () => {
  for (const [count, stride, offset, load] of [
    [2, 4, 1, "lbu"],
    [7, 8, 3, "lb"],
    [40, 16, 4, "lw"],
    [3, 6, 2, "lhu"],
  ] as const) {
    const relation = fitFixture({
      base: 0x80071000,
      stride,
      count,
      fields: [{ offset, load, rhs: { kind: "const", value: 7 } }],
      successValue: 1,
      failValue: -1,
    });
    assert.equal(relation.count, count);
    assert.equal(relation.stride, stride);
    /* With one field the record base is the first witnessed byte, so the
     * field offset folds into the base — the witnessed minimum, not a claim
     * about unseen leading bytes. */
    assert.equal(relation.base, 0x80071000 + offset);
    assert.equal(relation.tests[0]!.offset, 0);
    assert.equal(relation.tests[0]!.width, load === "lw" ? 4 : load.startsWith("lb") ? 1 : 2);
    assert.equal(relation.tests[0]!.signed, load === "lb" || load === "lw");
  }
});

test("a base whose low half crosses the sign boundary still fits", () => {
  /* %lo(0x8006c838) is negative; the hi/lo pair must still resolve. */
  const relation = fitFixture({
    base: 0x8006c838,
    stride: 12,
    count: 3,
    fields: [{ offset: 0, load: "lh", rhs: { kind: "const", value: 0 } }],
    successValue: 1,
    failValue: 0,
  });
  assert.equal(relation.base, 0x8006c838);
});

test("an index-valued success return fits as affine", () => {
  const relation = fitFixture({
    base: 0x80071000,
    stride: 4,
    count: 6,
    fields: [{ offset: 0, load: "lhu", rhs: { kind: "arg-zext16" } }],
    successValue: "index",
    failValue: -1,
  });
  assert.deepEqual(relation.successReturn, { kind: "affine", scale: 1, offset: 0 });
  assert.equal(relation.failReturn, -1);
});

test("the regression function's own shape — rotated, peeled, compensated — fits", () => {
  /* The exact instruction stream of ovl_11_func_800F13D8, from its
   * disassembly: separated first iteration, two induction pointers with a
   * compensating -0xC, and the argument masked in a delay slot. The fitter
   * must see through all of it to the same relation as the natural loop. */
  const words = [
    0x00004021, 0x00003821, 0x3c028007, 0x244342b0,
    0x24660002, 0x844542b0, 0x00000000, 0x14a00004,
    0x3084ffff, 0x84620002, 0x0803c50d, 0x00000000,
    0x24c6000c, 0x24e70001, 0x28e20005, 0x1040000b,
    0x2463000c, 0x84620000, 0x00000000, 0x1440fff9,
    0x24c6000c, 0x24c6fff4, 0x84c20000, 0x00000000,
    0x1444fff4, 0x24c6000c, 0x24080001, 0x03e00008,
    0x01001021,
  ].map((raw, index) => ({ raw, vram: 0x800f13d8 + index * 4 }));
  const executed = executeFunction(decodeFunction(words));
  const fit = fitScanRelation(executed.arena, executed.root);
  assert.ok(fit.fitted, `expected a fit: ${fit.fitted ? "" : fit.reason}`);
  if (fit.fitted) {
    assert.equal(fit.relation.base, 0x800742b0);
    assert.equal(fit.relation.stride, 12);
    assert.equal(fit.relation.count, 5);
    assert.equal(fit.relation.tests.length, 2);
  }
});

test("a non-scan decision structure is rejected with a reason", () => {
  const executed = executeFunction(decodeFunction(assemble([
    ["lui", "t2", 0x8007],
    ["lh", "v0", 0, "t2"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80100000)));
  const fit = fitScanRelation(executed.arena, executed.root);
  assert.ok(!fit.fitted);
});

test("a single-record chain is not called a scan", () => {
  const executed = executeFunction(decodeFunction(assemble([
    ["lui", "t2", 0x8007],
    ["lh", "v0", 0, "t2"],
    ["bne", "v0", "zero", "miss"],
    ["nop"],
    ["addiu", "v0", "zero", 1],
    ["jr", "ra"],
    ["nop"],
    ["label", "miss"],
    ["addu", "v0", "zero", "zero"],
    ["jr", "ra"],
    ["nop"],
  ], 0x80100000)));
  const fit = fitScanRelation(executed.arena, executed.root);
  assert.ok(!fit.fitted);
});
