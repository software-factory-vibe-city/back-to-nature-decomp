import assert from "node:assert/strict";
import test from "node:test";
import { classifyMemberBytes, measureCodeReference, measureMemberBytes } from "./memberClassification.ts";
import { UNKNOWN_TOOLCHAIN, type ToolchainProfile } from "./toolchainProfile.ts";

const KB = 1024;

/** A minimal but real function body: prologue, call, epilogue, return. */
const FUNCTION = [0x27bdffe8, 0xafbf0014, 0x0c005e99, 0x00000000, 0x8fbf0014, 0x03e00008, 0x27bd0018, 0x00000000];

function codeBytes(functions: number): Buffer {
  const buf = Buffer.alloc(functions * FUNCTION.length * 4);
  for (let f = 0; f < functions; f++) {
    FUNCTION.forEach((w, i) => buf.writeUInt32LE(w >>> 0, (f * FUNCTION.length + i) * 4));
  }
  return buf;
}

function dataBytes(size: number, fill: number): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i + 4 <= size; i += 4) buf.writeUInt32LE(fill >>> 0, i);
  return buf;
}

/* The reference is measured from a body known to be code, exactly as the CLI
   measures it from the project's own executable. Nothing is a constant. */
const REFERENCE_BODY = codeBytes(256);
const REFERENCE = measureCodeReference(REFERENCE_BODY, 0, REFERENCE_BODY.length, "synthetic known code");
const PSYQ: ToolchainProfile = { id: "psyq", version: null, verdict: "detected", evidence: [] };

test("the reference is measured, not assumed", () => {
  assert.equal(REFERENCE.decodeRatio, 1);
  /* 32 bytes per function, one return each: 32 returns per KB. */
  assert.equal(REFERENCE.returnsPerKb, 32);
});

test("a member of function bodies is code when judged against a reference of the same kind", () => {
  const verdict = classifyMemberBytes(codeBytes(64), "0x00000006", { reference: REFERENCE, profile: PSYQ });
  assert.equal(verdict.verdict, "code");
  assert.ok(verdict.evidence.some((e) => e.includes("returns/KB")));
  assert.ok(verdict.evidence.some((e) => e.includes("synthetic known code")));
});

test("a member with no return is data whatever its decodability", () => {
  /* Shift-JIS text: decodes as instructions by accident, but never returns. */
  const verdict = classifyMemberBytes(dataBytes(16 * KB, 0x7c817c81), "0x7c817c81", {
    reference: REFERENCE,
    profile: PSYQ,
  });
  assert.equal(verdict.verdict, "data");
  assert.ok(verdict.evidence.some((e) => e.includes("no code region of measurable size")));
});

test("a code region far sparser than the reference is undetermined, not resolved", () => {
  /* Sixteen functions of 512 bytes each: one contiguous decodable region, but a
     return every 512 bytes is 2/KB against the reference's 32/KB — sixteen
     times the reference's average function size, well past the bar. */
  const stride = 512;
  const buf = Buffer.alloc(16 * stride);
  for (let i = 0; i + 4 <= buf.length; i += 4) buf.writeUInt32LE(0x24020001, i); // addiu v0,zero,1
  for (let f = 0; f < 16; f++) {
    FUNCTION.forEach((w, i) => buf.writeUInt32LE(w >>> 0, f * stride + i * 4));
  }
  const verdict = classifyMemberBytes(buf, "0x00000000", { reference: REFERENCE, profile: PSYQ });
  assert.equal(verdict.verdict, "undetermined");
  assert.ok(verdict.evidence.some((e) => e.includes("below")));
});

test("without a reference no member can be called code", () => {
  const verdict = classifyMemberBytes(codeBytes(64), "0x00000006", { profile: PSYQ });
  assert.equal(verdict.verdict, "undetermined");
  assert.ok(verdict.evidence.some((e) => e.includes("no reference body of known code")));
});

test("an unknown toolchain still classifies, using only toolchain-independent strategies", () => {
  const verdict = classifyMemberBytes(codeBytes(64), "0x00000006", {
    reference: REFERENCE,
    profile: UNKNOWN_TOOLCHAIN,
  });
  assert.equal(verdict.verdict, "code");
  assert.ok(
    verdict.evidence.some((e) => e.includes("return-clustering")),
    "the generic strategy carries it"
  );
  assert.ok(
    !verdict.evidence.some((e) => e.includes("psyq-section-order:")),
    "the PSY-Q strategy must not run for an unknown toolchain"
  );
});

test("a VAB header is recognised and reported with its version", () => {
  const buf = dataBytes(16 * KB, 0);
  buf.writeUInt32LE(0x56414270, 0);
  buf.writeUInt32LE(7, 4);
  const verdict = classifyMemberBytes(buf, "0x56414270", { reference: REFERENCE, profile: PSYQ });
  assert.equal(verdict.verdict, "data");
  assert.equal(verdict.format, "VAB");
  assert.ok(verdict.evidence.some((e) => e.includes("version 7")));
});

test("a TIM id is only accepted with TIM-shaped flags, so an overlay id 0x10 does not collide", () => {
  const tim = dataBytes(16 * KB, 0);
  tim.writeUInt32LE(0x10, 0);
  tim.writeUInt32LE(0x08, 4);
  assert.equal(classifyMemberBytes(tim, "0x00000010", { reference: REFERENCE, profile: PSYQ }).format, "TIM");

  const overlay = Buffer.concat([Buffer.alloc(8), codeBytes(64)]);
  overlay.writeUInt32LE(0x10, 0);
  overlay.writeUInt32LE(0x8012ea5c, 4);
  const verdict = classifyMemberBytes(overlay, "0x00000010", { reference: REFERENCE, profile: PSYQ });
  assert.equal(verdict.verdict, "code");
});

test("a count-prefixed pointer table is recognised as a structure, not guessed at", () => {
  const buf = dataBytes(16 * KB, 0);
  buf.writeUInt32LE(3, 0);
  buf.writeUInt32LE(0x800b8054, 4);
  buf.writeUInt32LE(0x800b80fc, 8);
  buf.writeUInt32LE(0x800b8134, 12);
  const verdict = classifyMemberBytes(buf, "0x00000003", { reference: REFERENCE, profile: PSYQ });
  assert.equal(verdict.format, "pointer-table");
});

test("jal-shaped words outside PS1 RAM are counted separately from valid ones", () => {
  /* 0x8FF4xxxx is the measured false-positive class: opcode 3, target not RAM. */
  const m = measureMemberBytes(dataBytes(4 * KB, 0x0ff40000));
  assert.ok(m.jalTotal > 0);
  assert.equal(m.jalInRam, 0);
});
