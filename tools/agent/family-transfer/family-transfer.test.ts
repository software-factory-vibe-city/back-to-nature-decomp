/**
 * Family transfer: retrieval by word shape, anti-unification into a
 * substitution, AST instantiation, and verification by the byte oracle.
 *
 * The two claims worth testing are opposite ones. A correct substitution must
 * reproduce the target exactly — otherwise the whole route is decoration. And
 * a *wrong* substitution must be rejected — otherwise the route launders
 * similarity into an accepted result, which is the failure mode every
 * retrieval-shaped tool is prone to.
 */

import { strict as assert } from "node:assert";
import fs, { existsSync, readFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { antiUnify } from "./anti-unify.js";
import { applyEdits, enumerateCandidates, identityEdits, planInstantiation } from "./instantiate.js";
import { signatureFor } from "./signature.js";
import { transferFromDonor, verifyCandidate } from "./transfer.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/* The family the investigation closed: three neighbours whose lookup differs
 * only in the final field offset (0xAA, 0xAC, 0xAE). */
const TARGET = "ovl_11_func_800D5ABC";
const DONOR = "ovl_11_func_800D5B3C";
const SIBLING = "ovl_11_func_800D5BBC";

/* ---- retrieval ------------------------------------------------------------ */

projectTest("the flexible tier puts a one-offset family under one shape", () => {
  const shapes = [TARGET, DONOR, SIBLING].map((name) => signatureFor(name, "flexible").shape);
  assert.equal(new Set(shapes).size, 1, "all three members must share a shape");
});

projectTest("the strict tier keeps them apart, because their constants differ", () => {
  const target = signatureFor(TARGET, "strict");
  const donor = signatureFor(DONOR, "strict");
  assert.notEqual(target.shape, donor.shape, "strict preserves immediates, so a differing offset is a differing shape");
});

/* ---- anti-unification ----------------------------------------------------- */

projectTest("anti-unification isolates exactly the one differing offset", () => {
  const unified = antiUnify(signatureFor(DONOR, "flexible"), signatureFor(TARGET, "flexible"));
  assert.ok(unified.fitted, "same shape must anti-unify");
  assert.equal(unified.substitutions.length, 1, "one substitution, not a diff of everything");
  const [substitution] = unified.substitutions;
  assert.equal(substitution!.kind, "displacement");
  assert.equal(substitution!.donorValue, 0xac);
  assert.equal(substitution!.targetValue, 0xaa);
  assert.equal(substitution!.occurrences.length, 1);
});

test("one donor value mapping to two target values is refused, not averaged", () => {
  const donor = {
    functionName: "d", containerId: "exe", vram: 0, words: 2, tier: "flexible" as const,
    tokens: ["a ?", "b ?"], shape: "2:deadbeefdeadbeef",
    holes: [
      { index: 0, vram: 0, kind: "displacement" as const, value: 4 },
      { index: 1, vram: 4, kind: "displacement" as const, value: 4 },
    ],
  };
  const target = {
    ...donor,
    functionName: "t",
    holes: [
      { index: 0, vram: 0, kind: "displacement" as const, value: 8 },
      { index: 1, vram: 4, kind: "displacement" as const, value: 12 },
    ],
  };
  const unified = antiUnify(donor, target);
  assert.equal(unified.fitted, false);
  assert.match((unified as { reason: string }).reason, /cannot become two different things/);
});

test("different shapes never anti-unify, whatever their hole counts", () => {
  const left = {
    functionName: "l", containerId: "exe", vram: 0, words: 1, tier: "flexible" as const,
    tokens: ["lw r2,?(r4)"], shape: "1:aaaaaaaabbbbbbbb",
    holes: [{ index: 0, vram: 0, kind: "displacement" as const, value: 0 }],
  };
  const right = { ...left, functionName: "r", tokens: ["sw r2,?(r4)"], shape: "1:ccccccccdddddddd" };
  assert.equal(antiUnify(left, right).fitted, false);
});

/* ---- instantiation -------------------------------------------------------- */

test("identity edits follow names derived from the donor's address", () => {
  const source = [
    "typedef struct { int x; } D8006C838Lookup_800D5B3C;",
    "s32 ovl_11_func_800D5B3C(void *arg0) {",
    "    D8006C838Lookup_800D5B3C *v = (D8006C838Lookup_800D5B3C *)arg0;",
    "    return v->x;",
    "}",
  ].join("\n");
  const edited = applyEdits(source, identityEdits(source, "ovl_11_func_800D5B3C", "ovl_11_func_800D5ABC"));
  assert.ok(edited.includes("ovl_11_func_800D5ABC(void *arg0)"), "the function is renamed");
  assert.ok(!edited.includes("800D5B3C"), `no donor identity survives:\n${edited}`);
  assert.ok(edited.includes("D8006C838Lookup_800D5ABC"), "the derived typedef follows the rename");
});

test("a substituted literal keeps the donor's spelling", () => {
  const source = "int f(void) { return *(short *)(0x1000 + 0xAC); }";
  const plan = planInstantiation(source, "f", "g", [{
    kind: "displacement", donorValue: 0xac, targetValue: 0xaa,
    occurrences: [{ index: 0, donorVram: 0, targetVram: 0 }],
  }]);
  const enumerated = enumerateCandidates(plan);
  const text = applyEdits(source, enumerated.candidates[0]!.edits);
  assert.ok(text.includes("0xAA"), `hex case and width are preserved: ${text}`);
  assert.ok(!text.includes("0xAC"));
});

test("a lui-materialized constant is substituted at its source scale", () => {
  /* The machine holds 0x80000 because the compiler put the source's 8 in the
   * high half for a following `sra`. The literal to edit is 8, not 0x80000. */
  const source = "int f(short a) { return (short)(a + 8); }";
  const plan = planInstantiation(source, "f", "g", [{
    kind: "immediate-hi", donorValue: 0x80000, targetValue: 0xc0000,
    occurrences: [{ index: 0, donorVram: 0, targetVram: 0 }],
  }]);
  const enumerated = enumerateCandidates(plan);
  const text = applyEdits(source, enumerated.candidates[0]!.edits);
  assert.ok(text.includes("a + 12"), `the source literal moves 8 → 12, got: ${text}`);
});

test("an ambiguous constant yields several readings, never a silent pick", () => {
  const source = "int f(int *p) { return p[4] + p[4]; }";
  const plan = planInstantiation(source, "f", "g", [{
    kind: "displacement", donorValue: 4, targetValue: 8,
    occurrences: [{ index: 0, donorVram: 0, targetVram: 0 }],
  }]);
  const enumerated = enumerateCandidates(plan);
  assert.ok(enumerated.candidates.length >= 3, "all-sites plus each site alone");
});

test("overlapping edits are an error rather than a silent choice", () => {
  assert.throws(
    () => applyEdits("abcdef", [
      { start: 0, end: 3, text: "X", reason: "a" },
      { start: 2, end: 5, text: "Y", reason: "b" },
    ]),
    /overlapping edits/,
  );
});

/* ---- end to end ----------------------------------------------------------- */

projectTest("the lookup transfer reproduces the target byte-exactly", () => {
  const attempt = transferFromDonor(TARGET, DONOR, { tier: "flexible" });
  assert.equal(attempt.refused, undefined);
  assert.ok(attempt.winner, `expected an exact candidate; got ${JSON.stringify(attempt.candidates)}`);
  const winner = attempt.candidates.find((candidate) => candidate.id === attempt.winner!.id)!;
  assert.equal(winner.verdict, "match");
  assert.equal(winner.matchedWords, winner.totalWords);
});

projectTest("a wrong field mapping is rejected by the oracle, not accepted", () => {
  /* The donor's own C, renamed but with the field offset left at the donor's
   * 0xAC, is exactly the "deliberately wrong mapping" case: it compiles, it
   * looks right, and it is not this function. */
  const donorSource = readFileSync(join(ROOT, "src/overlays/ovl_11", `${DONOR}.c`), "utf-8");
  const wrong = applyEdits(donorSource, identityEdits(donorSource, DONOR, TARGET));
  const result = verifyCandidate(TARGET, wrong, "wrong-field");
  assert.notEqual(result.verdict, "match", "an unsubstituted field offset must not be accepted");
  assert.equal(result.verdict, "mismatch");
});

projectTest("a wrong callee mapping is rejected by the oracle", () => {
  /* Same donor, correct offset, but the symbol the lookup reaches through
   * replaced by a different global. Every word but the relocated ones agrees,
   * which is precisely the case a similarity score would pass. */
  const attempt = transferFromDonor(TARGET, DONOR, { tier: "flexible" });
  assert.ok(attempt.winner, "the correct transfer must succeed first");
  const corrupted = attempt.winner!.source.replace(/D_8006C838/g, "D_8006C83C");
  assert.notEqual(corrupted, attempt.winner!.source, "the probe must actually change the symbol");
  const result = verifyCandidate(TARGET, corrupted, "wrong-symbol");
  assert.notEqual(result.verdict, "match", "a wrong symbol must not be accepted");
});

projectTest("a donor that still hands its body to the assembler is refused", (t) => {
  /* Keep the real family geometry, but supply a stub without changing live C
   * or relying on a particular family member remaining undecompiled. */
  const donorPath = join(ROOT, "src/overlays/ovl_11", `${TARGET}.c`);
  const readFromDisk = fs.readFileSync;
  const readMock = t.mock.method(fs, "readFileSync", (path, options) => {
    if (path === donorPath) {
      return `#include "common.h"\nINCLUDE_ASM("asm/nonmatchings/${TARGET}", ${TARGET});\n`;
    }
    return readFromDisk(path, options);
  });
  syncBuiltinESMExports();
  try {
    const attempt = transferFromDonor(DONOR, TARGET, { tier: "flexible" });
    assert.ok(attempt.refused, "a stub cannot donate");
    assert.match(attempt.refused!, /assembler/);
    assert.equal(attempt.candidates.length, 0);
  } finally {
    readMock.mock.restore();
    syncBuiltinESMExports();
  }
});
