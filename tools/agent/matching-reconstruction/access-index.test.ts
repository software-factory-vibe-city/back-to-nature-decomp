import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decodeFunction } from "./decode.js";
import { mineFunctionWitnesses } from "./access-index.js";
import { assemble } from "./fixture-asm.js";

const mine = (lines: Parameters<typeof assemble>[0]) =>
  mineFunctionWitnesses(decodeFunction(assemble(lines, 0x800db000)), "fixture", "test");

test("an explicit base-plus-offset add is witnessed with its anchor", () => {
  /* The func_800DBB94 pattern: materialize D_8006C838, add 0x7A78, walk. */
  const witnesses = mine([
    ["lui", "v0", 0x8007],
    ["addiu", "v0", "v0", -0x37c8],
    ["addiu", "v1", "v0", 0x7a78],
    ["lh", "a1", 0, "v1"],
    ["jr", "ra"],
    ["nop"],
  ]);
  const add = witnesses.find((witness) => witness.kind === "add");
  assert.ok(add, "expected an add witness");
  assert.equal(add!.anchor, 0x8006c838);
  assert.equal(add!.address, 0x800742b0);
  const load = witnesses.find((witness) => witness.kind === "load");
  assert.ok(load);
  assert.equal(load!.anchor, 0x8006c838);
  assert.equal(load!.address, 0x800742b0);
  assert.equal(load!.width, 2);
});

test("a lui completed by the memory operand anchors at the full address", () => {
  const witnesses = mine([
    ["lui", "v0", 0x8007],
    ["lh", "a1", 0x42b0, "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  assert.equal(witnesses.length, 1);
  assert.equal(witnesses[0]!.anchor, 0x800742b0);
  assert.equal(witnesses[0]!.address, 0x800742b0);
});

test("tracking dies at a join point rather than crossing it", () => {
  /* The materialized base sits before a branch target; using it after the
   * label would trust a value another predecessor may not have set. */
  const witnesses = mine([
    ["lui", "v0", 0x8007],
    ["addiu", "v0", "v0", -0x37c8],
    ["bne", "a0", "zero", "join"],
    ["nop"],
    ["label", "join"],
    ["lh", "a1", 0x10, "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  assert.equal(witnesses.filter((witness) => witness.kind === "load").length, 0);
});

test("a call clobbers everything tracked", () => {
  const witnesses = mine([
    ["lui", "v0", 0x8007],
    ["addiu", "v0", "v0", -0x37c8],
    ["jal", 0x80020000],
    ["nop"],
    ["lh", "a1", 0x10, "v0"],
    ["jr", "ra"],
    ["nop"],
  ]);
  assert.equal(witnesses.filter((witness) => witness.kind === "load").length, 0);
});

test("negative offsets from an anchor are not recorded as containment", () => {
  const witnesses = mine([
    ["lui", "v0", 0x8007],
    ["addiu", "v0", "v0", -0x37c8],
    ["addiu", "v1", "v0", -0x10],
    ["jr", "ra"],
    ["nop"],
  ]);
  assert.equal(witnesses.filter((witness) => witness.kind === "add").length, 0);
});
