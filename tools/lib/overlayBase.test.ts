import assert from "node:assert/strict";
import test from "node:test";
import { collectSelfReferences, scoreBase, solveMemberBase, weighted } from "./overlayBase.ts";

const EXE = { start: 0x80010000, end: 0x8005e800 };
const BASE = 0x800b8000;

function jal(target: number): number {
  return (0x0c000000 | ((target & 0x0fffffff) >>> 2)) >>> 0;
}
function j(target: number): number {
  return (0x08000000 | ((target & 0x0fffffff) >>> 2)) >>> 0;
}

const PROLOGUE = 0x27bdffe8; // addiu sp,sp,-24
const JR_RA = 0x03e00008;
const NOP = 0x00000000;
const ADDIU_V0 = 0x24020001; // addiu v0,zero,1

/**
 * A synthetic member: `functions` functions of deliberately unequal length,
 * each opening with a prologue and ending with `jr ra`; the first calls every
 * other one, and calls the engine too.
 *
 * The lengths differ because a periodic member would let a base off by one
 * whole function collect as many votes as the right one — real compiled code is
 * not periodic, and a fixture that is would test the wrong thing.
 */
function buildMember(functions: number): { bytes: Buffer; entries: number[] } {
  const bodies = Array.from({ length: functions }, (_, f) => 5 + ((f * 3) % 7));
  const layout: number[] = [];
  let at = functions + 2; // room for the first function's call block
  for (const body of bodies) {
    layout.push(at);
    at += body + 2;
  }
  const bytes = Buffer.alloc(at * 4);
  const entries = layout.map((offset) => BASE + offset * 4);

  bytes.writeUInt32LE(PROLOGUE, 0);
  for (let f = 1; f < functions; f++) bytes.writeUInt32LE(jal(entries[f]!), f * 4);
  bytes.writeUInt32LE(jal(0x8001fabc), functions * 4);
  bytes.writeUInt32LE(JR_RA, (functions + 1) * 4);

  bodies.forEach((body, f) => {
    const start = layout[f]!;
    bytes.writeUInt32LE(PROLOGUE, start * 4);
    for (let i = 1; i < body; i++) bytes.writeUInt32LE(ADDIU_V0, (start + i) * 4);
    bytes.writeUInt32LE(JR_RA, (start + body) * 4);
    bytes.writeUInt32LE(NOP, (start + body + 1) * 4);
  });

  return { bytes, entries };
}

test("the base is solved from the vote and its certificate names the winner", () => {
  const { bytes } = buildMember(5);
  const certificate = solveMemberBase({ id: "ovl_test", bytes, exeImage: EXE });
  assert.equal(certificate.verdict, "resolved");
  assert.equal(certificate.base, BASE);
  assert.ok(certificate.evidence.some((e) => e.includes("winning base")));
  assert.ok(certificate.margin > 0.1, `margin ${certificate.margin} should clear the bar`);
});

test("engine calls are excluded from the self-reference set, so they never move the vote", () => {
  const { bytes } = buildMember(5);
  const refs = collectSelfReferences({ id: "ovl_test", bytes, exeImage: EXE });
  assert.ok(!refs.calls.includes(0x8001fabc));
  assert.equal(refs.calls.length, 4);
});

test("a deliberately wrong base scores far below the solved one", () => {
  const { bytes } = buildMember(6);
  const input = { id: "ovl_test", bytes, exeImage: EXE };
  const refs = collectSelfReferences(input);
  const right = weighted(scoreBase(input, refs, BASE));
  const wrong = weighted(scoreBase(input, refs, BASE + 4));
  assert.equal(right, 1);
  assert.ok(wrong < 0.5, `a base off by one instruction scored ${wrong}`);
});

test("a jal-shaped data word outside PS1 RAM is rejected rather than voted with", () => {
  const { bytes } = buildMember(4);
  const poisoned = Buffer.concat([bytes, Buffer.alloc(4)]);
  poisoned.writeUInt32LE((0x0c000000 | (0x0ff40000 >>> 2)) >>> 0, bytes.length);
  const refs = collectSelfReferences({ id: "ovl_test", bytes: poisoned, exeImage: EXE });
  assert.equal(refs.rejected, 1);
  assert.ok(refs.calls.every((t) => t >= 0x80000000 && t < 0x80200000));
});

test("a member with no absolute self-reference is undetermined, not guessed", () => {
  const bytes = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) bytes.writeUInt32LE(ADDIU_V0, i * 4);
  const certificate = solveMemberBase({ id: "ovl_empty", bytes, exeImage: EXE });
  assert.equal(certificate.verdict, "undetermined");
  assert.equal(certificate.base, null);
  assert.match(certificate.residuals[0]!, /no absolute self-reference/);
});

test("a criterion with no evidence is dropped rather than scored as satisfied", () => {
  const { bytes } = buildMember(4);
  const input = { id: "ovl_test", bytes, exeImage: EXE };
  const refs = collectSelfReferences(input);
  const criteria = scoreBase(input, refs, BASE);
  assert.ok(!criteria.some((c) => c.name === "headPointersInside"), "no leading pointer table exists here");
  assert.ok(!criteria.some((c) => c.name === "slotAgreement"), "no other member has been solved");
});

test("slot agreement is evidence, and separates two bases the member alone cannot", () => {
  /* A member with jumps but no internal calls: its own evidence is thin. */
  const bytes = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) bytes.writeUInt32LE(ADDIU_V0, i * 4);
  bytes.writeUInt32LE(j(BASE + 0x20), 0);
  const input = { id: "ovl_thin", bytes, exeImage: EXE };
  const refs = collectSelfReferences(input);
  const withAgreement = weighted(scoreBase(input, refs, BASE, undefined, [BASE]));
  const withoutAgreement = weighted(scoreBase(input, refs, BASE + 4, undefined, [BASE]));
  assert.ok(withAgreement > withoutAgreement);
});

test("a slot mate at the same base cannot explain a target, because they are never co-resident", () => {
  const { bytes } = buildMember(4);
  const input = { id: "ovl_test", bytes, exeImage: EXE };
  const refs = collectSelfReferences(input);
  /* A resolver that would happily explain anything, but only for a different base. */
  const resolver = (_address: number, candidateBase: number) =>
    candidateBase === BASE
      ? { contained: false, atEntry: false, decodable: false }
      : { contained: true, atEntry: true, decodable: true };
  const sameSlot = weighted(scoreBase(input, refs, BASE, resolver, [BASE]));
  const otherBase = weighted(scoreBase(input, refs, BASE + 0x1000, resolver, [BASE]));
  assert.equal(sameSlot, 1);
  assert.ok(otherBase < 1, "a wrong base must not reach a perfect score through a neighbour");
});
