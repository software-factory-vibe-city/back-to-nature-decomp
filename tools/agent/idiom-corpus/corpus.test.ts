import { strict as assert } from "node:assert";
import { test } from "node:test";
import { IdiomIndex, excludedReason, regionsOf, type Corpus } from "./corpus.js";
import { compatibility, type ToolchainFingerprint } from "./fingerprint.js";
import type { MirInsn, MirProgram } from "../pipeline-reversal/types.js";

function insn(index: number, block: number, mnemonic: string, operands: string[], extra: Partial<MirInsn> = {}): MirInsn {
  return {
    index,
    id: index,
    mnemonic,
    operands,
    text: `${mnemonic} ${operands.join(",")}`,
    shape: "",
    defs: [],
    uses: [],
    isCall: false,
    isBranch: false,
    isJump: false,
    isLoad: false,
    isStore: false,
    isNop: false,
    block,
    ...extra,
  } as MirInsn;
}

function program(insns: MirInsn[]): MirProgram {
  return { insns, blocks: [] } as unknown as MirProgram;
}

test("a source that hands work to the assembler is excluded, and why is named", () => {
  assert.equal(excludedReason('INCLUDE_ASM("build/asm/nonmatchings/f", f);'), "include-asm");
  assert.equal(excludedReason('void f(void) { __asm__ volatile ("nop"); }'), "embedded-asm");
  assert.equal(excludedReason("register int x __asm__(\"$s0\");"), "register-asm");
  /* Clean C, including a translation unit that only *mentions* assembly in
     prose, stays in the corpus. */
  assert.equal(excludedReason("/* no asm here, just a comment about asm */\nint f(void) { return 0; }"), undefined);
});

test("regions cover blocks, loops and windows, and skip runs too short to mean anything", () => {
  const insns = [
    insn(0, 0, "addiu", ["sp", "sp", "-24"]),
    insn(1, 0, "sw", ["ra", "20(sp)"], { isStore: true }),
    insn(2, 0, "move", ["s0", "zero"]),
    insn(3, 1, "lbu", ["a2", "0(s0)"], { isLoad: true }),
    insn(4, 1, "addiu", ["s0", "s0", "1"]),
    insn(5, 1, "slti", ["v0", "s0", "16"]),
    insn(6, 1, "bnez", ["v0", "L"], { isBranch: true, branchTargetIndex: 3 }),
    insn(7, 2, "lw", ["ra", "20(sp)"], { isLoad: true }),
  ];
  const regions = regionsOf("f", program(insns), 0, "fp1");
  const kinds = new Set(regions.map((region) => region.kind));
  assert.ok(kinds.has("block"), "blocks are regions");
  assert.ok(kinds.has("loop"), "a back-edge makes a loop region");
  assert.ok(kinds.has("window"), "sliding windows cross block boundaries");
  /* Block 2 has one instruction; a one-instruction region matches everything. */
  assert.equal(regions.some((region) => region.kind === "block" && region.block === 2), false);
  /* The loop region reaches back past the header, because the preheader is
     where an invariant address lands. */
  const loop = regions.find((region) => region.kind === "loop")!;
  assert.ok(loop.from < 3, "the loop region includes preheader instructions");
});

test("the index ranks by what aligned, and reports both coverage ratios", () => {
  const shared = ["lui <s>,<hi16>", "addiu <s>,<s>,<lo16>", "lbu <a>,0(<s>)", "jal <call>", "addiu <s>,<s>,1"];
  const corpus: Corpus = {
    fingerprints: {},
    included: ["twin", "other"],
    excluded: [],
    tier: 0,
    regions: [
      { functionName: "twin", kind: "loop", block: 4, from: 0, to: 5, tokens: shared, fingerprint: "fp1" },
      {
        functionName: "other",
        kind: "block",
        block: 0,
        from: 0,
        to: 5,
        tokens: ["sw <s>,<stkoff>(<sp>)", "sw <s>,<stkoff>(<sp>)", "sw <ra>,<stkoff>(<sp>)", "move <s>,<a>", "jal <call>"],
        fingerprint: "fp1",
      },
    ],
  };
  const hits = new IdiomIndex(corpus).search(shared, { limit: 2 });
  assert.equal(hits[0]!.region.functionName, "twin");
  assert.equal(hits[0]!.common, shared.length);
  assert.equal(hits[0]!.ratio, 1);
  assert.equal(hits[0]!.queryRatio, 1);
});

test("with no fingerprint the tool weakens its claim rather than inventing one", () => {
  const corpus: Corpus = {
    fingerprints: {},
    included: ["twin"],
    excluded: [],
    tier: 0,
    regions: [{ functionName: "twin", kind: "block", block: 0, from: 0, to: 4, tokens: ["a", "b", "c", "d"], fingerprint: "fp1" }],
  };
  const hit = new IdiomIndex(corpus).search(["a", "b", "c", "d"], { limit: 1 })[0]!;
  assert.match(hit.claim, /hypothesis/);
  assert.equal(hit.distance, "unknown");
});

function fingerprint(overrides: Partial<ToolchainFingerprint> = {}): ToolchainFingerprint {
  return {
    gcc: "2.95.2",
    container: "overlay",
    flags: ["-G0", "-O2"],
    overrides: [],
    id: "gcc2.95.2/overlay",
    ...overrides,
  };
}

test("an identical build makes the alignment proof", () => {
  const result = compatibility(fingerprint(), fingerprint());
  assert.equal(result.distance, "identical");
  assert.deepEqual(result.provenAxes, ["controlFlow", "population", "schedule", "allocation"]);
});

test("a differing flag costs exactly the axes it owns, and no more", () => {
  const query = fingerprint();
  const hit = fingerprint({
    flags: ["-G0", "-O2", "-fno-schedule-insns"],
    overrides: ["-fno-schedule-insns"],
    id: "gcc2.95.2/overlay+-fno-schedule-insns",
  });
  const result = compatibility(query, hit);
  assert.equal(result.distance, "flags");
  assert.deepEqual(result.unprovenAxes.map((item) => item.axis), ["schedule"]);
  assert.deepEqual(result.provenAxes, ["controlFlow", "population", "allocation"]);
  assert.match(result.claim, /-fno-schedule-insns/);
});

test("an unclassified flag costs every axis rather than being assumed harmless", () => {
  const result = compatibility(fingerprint(), fingerprint({ flags: ["-G0", "-O2", "-fwhatever"], id: "x" }));
  assert.equal(result.provenAxes.length, 0);
  assert.match(result.unprovenAxes[0]!.because, /unclassified/);
});

test("a different compiler keeps the idiom and drops the alignment", () => {
  const result = compatibility(fingerprint(), fingerprint({ gcc: "2.7.2", id: "gcc2.7.2/overlay" }));
  assert.equal(result.distance, "compiler-major");
  assert.equal(result.provenAxes.length, 0);
  assert.match(result.claim, /never claim the assembly aligns/);
});
