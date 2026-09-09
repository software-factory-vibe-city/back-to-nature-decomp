import { strict as assert } from "node:assert";
import { test } from "node:test";
import { constructCandidate, deriveParams, enumerateChoices } from "./construct.js";
import type { ConstructionChoice, ScanRelation } from "./types.js";

/** The regression relation, as the fitter recovers it — not as any source spells it. */
const RELATION: ScanRelation = {
  base: 0x800742b0,
  stride: 12,
  count: 5,
  tests: [
    { offset: 0, width: 2, signed: true, op: "eq", rhs: { kind: "const", value: 0 } },
    { offset: 2, width: 2, signed: true, op: "eq", rhs: { kind: "arg", use: { register: "a0", conversion: "zext16" } } },
  ],
  successReturn: { kind: "const", value: 1 },
  failReturn: 0,
  witnessedExtent: 12 * 4 + 4,
  evidence: [],
};

const EMBEDDED: ConstructionChoice["origin"] = {
  kind: "embedded",
  parentSymbol: "D_8006C838",
  parentAddress: 0x8006c838,
  offset: 0x7a78,
  startIndex: 0,
  evidence: [],
};

test("a zext16 argument use derives an unsigned halfword parameter", () => {
  const params = deriveParams(RELATION);
  assert.ok(Array.isArray(params));
  assert.deepEqual(params, [{ name: "arg0", type: "u16", register: "a0" }]);
});

test("conflicting conversions of one argument are rejected", () => {
  const conflicted: ScanRelation = {
    ...RELATION,
    tests: [
      { offset: 0, width: 2, signed: true, op: "eq", rhs: { kind: "arg", use: { register: "a0", conversion: "zext16" } } },
      { offset: 2, width: 2, signed: true, op: "eq", rhs: { kind: "arg", use: { register: "a0", conversion: "sext16" } } },
    ],
  };
  const params = deriveParams(conflicted);
  assert.ok(!Array.isArray(params) && /two conversions/.test(params.invalid));
});

test("the embedded rows constructor emits the view, the cast access, and C89 shape", () => {
  const constructed = constructCandidate("fixture_func", RELATION, {
    origin: EMBEDDED,
    layout: { kind: "rows", elementWidth: 2, signed: true, columns: 0 },
    loop: "index",
    result: "break-flag",
    condition: "nested",
    context: "standalone",
  });
  assert.ok(!("invalid" in constructed));
  const source = constructed.source;
  assert.match(source, /char pad\[0x7A78\];/);
  assert.match(source, /s16 records\[5\]\[6\];/);
  assert.match(source, /extern u8 D_8006C838\[\];/);
  assert.match(source, /s32 fixture_func\(u16 arg0\)/);
  assert.match(source, /\(\(ReconView \*\)D_8006C838\)->records\[i\]\[0\] == 0/);
  assert.match(source, /records\[i\]\[1\] == arg0/);
  assert.match(source, /break;/);
  assert.ok(!source.includes("//"), "C89 sources use /* */ comments only");
  assert.ok(constructed.integrationPlan.length > 0);
});

test("the scalar-record layout pads to the stride and names fields by offset", () => {
  const constructed = constructCandidate("fixture_func", RELATION, {
    origin: EMBEDDED,
    layout: { kind: "scalar-record" },
    loop: "cursor",
    result: "direct-return",
    condition: "conjunction",
    context: "standalone",
  });
  assert.ok(!("invalid" in constructed));
  assert.match(constructed.source, /s16 unk0;/);
  assert.match(constructed.source, /s16 unk2;/);
  assert.match(constructed.source, /char pad_4\[0x8\];/);
  assert.match(constructed.source, /record->unk0 == 0 && record->unk2 == arg0/);
  assert.match(constructed.source, /return 1;/);
});

test("an offset-start origin loops from its record index over the full table", () => {
  const constructed = constructCandidate("fixture_func", { ...RELATION, count: 4 }, {
    origin: { ...EMBEDDED, startIndex: 1 },
    layout: { kind: "rows", elementWidth: 2, signed: true, columns: 0 },
    loop: "index",
    result: "direct-return",
    condition: "nested",
    context: "standalone",
  });
  assert.ok(!("invalid" in constructed));
  assert.match(constructed.source, /s16 records\[5\]\[6\];/, "the table keeps its unvisited first record");
  assert.match(constructed.source, /for \(i = 1; i < 5; i\+\+\)/);
});

test("an affine return shifts its constant term under an offset start", () => {
  const constructed = constructCandidate("fixture_func", {
    ...RELATION,
    count: 4,
    successReturn: { kind: "affine", scale: 1, offset: 0 },
  }, {
    origin: { ...EMBEDDED, startIndex: 1 },
    layout: { kind: "rows", elementWidth: 2, signed: true, columns: 0 },
    loop: "index",
    result: "direct-return",
    condition: "nested",
    context: "standalone",
  });
  assert.ok(!("invalid" in constructed));
  /* Window record 0 is loop iteration i=1; the emitted value must still be 0. */
  assert.match(constructed.source, /return i \+ -1;/);
});

test("layouts that cannot express the fields are invalid, not emitted", () => {
  const mixed: ScanRelation = {
    ...RELATION,
    tests: [
      { offset: 0, width: 4, signed: true, op: "eq", rhs: { kind: "const", value: 0 } },
      { offset: 6, width: 2, signed: false, op: "eq", rhs: { kind: "const", value: 1 } },
    ],
  };
  const constructed = constructCandidate("fixture_func", mixed, {
    origin: EMBEDDED,
    layout: { kind: "rows", elementWidth: 4, signed: true, columns: 0 },
    loop: "index",
    result: "break-flag",
    condition: "nested",
    context: "standalone",
  });
  assert.ok("invalid" in constructed);
});

test("the enumeration order is deterministic and complete", () => {
  const origins: ConstructionChoice["origin"][] = [
    { kind: "standalone", symbol: "D_800742B0", startIndex: 0, evidence: [] },
    EMBEDDED,
  ];
  const first = enumerateChoices(RELATION, origins);
  const second = enumerateChoices(RELATION, origins);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2 * 2 * 3 * 2 * 2 * 2);
  assert.equal(first[0]!.origin.kind, "standalone");
  assert.equal(first[first.length - 1]!.origin.kind, "embedded");
});
