import assert from "node:assert/strict";
import test from "node:test";
import { detectArchiveIndex, readIndexEntries, SECTOR_SIZE } from "./archiveIndex.ts";

function u32Table(values: number[]): Uint8Array {
  const buf = new Uint8Array(values.length * 4);
  const view = new DataView(buf.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v >>> 0, true));
  return buf;
}

/* Four members of one, two, one and three sectors, indexed by a trailing-sentinel
   offset table — the shape a PSX overlay container uses. */
const STARTS = [0, 1, 3, 4, 7].map((s) => s * SECTOR_SIZE);
const DATA_SIZE = 7 * SECTOR_SIZE;

test("a trailing-sentinel offset table resolves to one member per gap", () => {
  const verdict = detectArchiveIndex(u32Table(STARTS), DATA_SIZE);
  assert.equal(verdict.kind, "resolved");
  if (verdict.kind !== "resolved") return;
  assert.equal(verdict.format, "u32-offset-table");
  assert.equal(verdict.members.length, STARTS.length - 1);
  assert.deepEqual(verdict.members[0], { index: 0, start: 0, end: SECTOR_SIZE });
  assert.equal(verdict.members[3]!.end, DATA_SIZE);
});

test("the winning hypothesis reports its evidence and its margin", () => {
  const verdict = detectArchiveIndex(u32Table(STARTS), DATA_SIZE);
  assert.equal(verdict.kind, "resolved");
  if (verdict.kind !== "resolved") return;
  assert.equal(verdict.score, 1);
  assert.ok(verdict.margin >= 0.15, `margin ${verdict.margin} should clear the bar`);
  assert.ok(verdict.criteria.some((c) => c.name === "tilesExactly" && c.value === 1));
  assert.ok(verdict.notes.some((n) => n.includes("trailing sentinel")));
});

test("a table with no sentinel is read as starts, with the last member running to the end", () => {
  const verdict = detectArchiveIndex(u32Table(STARTS.slice(0, -1)), DATA_SIZE);
  assert.equal(verdict.kind, "resolved");
  if (verdict.kind !== "resolved") return;
  assert.equal(verdict.members.length, 4);
  assert.equal(verdict.members[3]!.end, DATA_SIZE);
  assert.ok(verdict.notes.some((n) => n.includes("is not the data size")));
});

test("a corrupted index is reported undetermined rather than guessed", () => {
  const shuffled = [0, 3, 1, 7, 4].map((s) => s * SECTOR_SIZE);
  const verdict = detectArchiveIndex(u32Table(shuffled), DATA_SIZE);
  assert.equal(verdict.kind, "undetermined");
  if (verdict.kind !== "undetermined") return;
  assert.match(verdict.reason, /below the .* bar/);
  assert.ok(verdict.candidates.length > 0, "candidates are still reported for inspection");
});

test("an index whose length is not a multiple of 4 is undetermined, not truncated", () => {
  const verdict = detectArchiveIndex(new Uint8Array([1, 2, 3]), DATA_SIZE);
  assert.equal(verdict.kind, "undetermined");
  if (verdict.kind !== "undetermined") return;
  assert.match(verdict.reason, /multiple of 4/);
});

test("a (start, size) pair table does not win when the offset reading tiles the file", () => {
  const verdict = detectArchiveIndex(u32Table(STARTS), DATA_SIZE);
  assert.equal(verdict.kind, "resolved");
  if (verdict.kind !== "resolved") return;
  const pairs = verdict.candidates.find((c) => c.id === "u32-offset-size-pairs");
  assert.ok(pairs);
  assert.ok(pairs!.score < verdict.score);
});

test("entries are read little-endian", () => {
  assert.deepEqual(readIndexEntries(new Uint8Array([0x00, 0x08, 0x00, 0x00])), [0x800]);
});
