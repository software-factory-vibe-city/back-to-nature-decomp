import assert from "node:assert/strict";
import test from "node:test";
import { scanMembers, type MemberBytes } from "./overlayReferences.ts";

const EXE = { start: 0x80010000, end: 0x8005e800 };

function member(id: string, words: number[]): MemberBytes {
  const bytes = Buffer.alloc(words.length * 4);
  words.forEach((w, i) => bytes.writeUInt32LE(w >>> 0, i * 4));
  return { id, size: bytes.length, bytes };
}

/** `jal target` encoded for a KSEG0 address. */
function jal(target: number): number {
  return (0x0c000000 | ((target & 0x0fffffff) >>> 2)) >>> 0;
}

test("a jal into the PS-X EXE image is counted as an engine API call site", () => {
  const scan = scanMembers([member("ovl_10", [jal(0x8001fabc), jal(0x8001fabc)])], EXE);
  const entry = scan.exeCallTargets.get(0x8001fabc);
  assert.equal(entry?.sites, 2);
  assert.deepEqual(entry?.members, ["ovl_10"]);
  assert.equal(scan.perMember[0]!.exeTargets, 1);
  assert.equal(scan.perMember[0]!.exeCallSites, 2);
});

test("a jal outside the EXE image is a self-call and buckets by slot", () => {
  const scan = scanMembers([member("ovl_11", [jal(0x800d1234)])], EXE);
  assert.equal(scan.exeCallTargets.size, 0);
  assert.equal(scan.slotCallTargets.get(0x800d1234)?.sites, 1);
  assert.equal(scan.perMember[0]!.slotBuckets["0x800d"], 1);
});

test("a jal-shaped data word outside PS1 RAM is rejected, not counted", () => {
  /* 0x8FF4xxxx is the measured false-positive class: opcode 3, target not RAM. */
  const scan = scanMembers([member("ovl_28", [(0x0c000000 | (0x0ff40000 >>> 2)) >>> 0])], EXE);
  assert.equal(scan.exeCallTargets.size, 0);
  assert.equal(scan.slotCallTargets.size, 0);
  assert.equal(scan.totalRejectedJalWords, 1);
  assert.equal(scan.perMember[0]!.rejectedJalWords, 1);
});

test("call sites from several members are attributed to each of them", () => {
  const scan = scanMembers(
    [member("ovl_10", [jal(0x80012a34)]), member("ovl_19", [jal(0x80012a34), jal(0x80012a34)])],
    EXE
  );
  const entry = scan.exeCallTargets.get(0x80012a34);
  assert.equal(entry?.sites, 3);
  assert.deepEqual([...entry!.members].sort(), ["ovl_10", "ovl_19"]);
});

test("a stored pointer into the EXE is a literal reference, separate from calls", () => {
  const scan = scanMembers([member("ovl_08", [0x8001af44])], EXE);
  assert.equal(scan.exeCallTargets.size, 0);
  assert.equal(scan.literalReferences.get(0x8001af44)?.sites, 1);
});

test("a lui/addiu pair is resolved into the RAM map", () => {
  /* lui v0,0x8006 ; addiu v0,v0,-0x1800  ->  0x8005E800, the shared BSS region */
  const scan = scanMembers([member("ovl_11", [0x3c028006, 0x2442e800])], EXE);
  assert.ok(scan.resolvedAddresses.has(0x8005e800));
});

test("members are reported largest first, so the summary reads like the scope table", () => {
  const scan = scanMembers([member("ovl_31", [0]), member("ovl_11", [0, 0, 0])], EXE);
  assert.deepEqual(scan.perMember.map((m) => m.id), ["ovl_11", "ovl_31"]);
});
