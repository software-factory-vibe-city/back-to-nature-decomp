import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { groupHeadingOf, readGroups, siblingsOf } from "./fileGroupings.js";

/** A note in the shape the real one has: prose bullets mixed into the lists. */
const NOTE = `# Suspected source-file groupings (ledger)

Rules:
- Every group heading names its container.
- Every entry cites its evidence class (shared gp-rel cluster, call graph).

## \`ovl_10\` status cluster — 0x800B814C (confidence: low)

Fingerprints:
- shared string cluster: D_800B814C is one contiguous block (see below);
- call graph: func_a dispatches to func_b (m) which is not a member line.

Members (address order):
- func_a (m, matched 2026-08-22) — the printer
- func_b (s) — parked, best key [0,0,1,0]
- func_c (?) — membership uncertain

## \`exe\` tail pair — 0x80013000 (confidence: high)

Members:
- func_d (m) — leaf predicate
- func_a (m) — also here, which is what the note allows
`;

function withNote<T>(body: (path: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), "groupings-"));
  const path = join(directory, "file-groupings.md");
  writeFileSync(path, NOTE);
  try {
    return body(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("a group is a heading and the marked bullets under its Members list", () => {
  withNote((path) => {
    const groups = readGroups(path);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0]!.members, ["func_a", "func_b", "func_c"]);
    assert.deepEqual(groups[1]!.members, ["func_d", "func_a"]);
  });
});

test("a prose bullet is not a member, however much it looks like one", () => {
  /* The reason the match-status marker is required: an evidence bullet that
     names a function contributes its first word otherwise, and every consumer
     then tries to compile a translation unit that does not exist. */
  withNote((path) => {
    assert.equal(readGroups(path)[0]!.members.includes("call"), false);
    assert.equal(readGroups(path)[0]!.members.includes("shared"), false);
  });
});

test("siblings span every group a function is recorded in, and exclude itself", () => {
  withNote((path) => {
    assert.deepEqual(siblingsOf("func_a", path).sort(), ["func_b", "func_c", "func_d"]);
    assert.deepEqual(siblingsOf("func_d", path), ["func_a"]);
  });
});

test("a function the note does not record has no siblings and no group", () => {
  /* Not an error: the ledger is a prior, not a partition, and most functions
     are not in it. A consumer that treated absence as a failure would report
     one on the majority of the tree. */
  withNote((path) => {
    assert.deepEqual(siblingsOf("func_unknown", path), []);
    assert.equal(groupHeadingOf("func_unknown", path), undefined);
  });
});

test("the heading is carried, so a finding can say which cluster it read", () => {
  withNote((path) => {
    assert.match(groupHeadingOf("func_b", path)!, /status cluster/);
  });
});

test("a missing note is an empty ledger, not a throw", () => {
  assert.deepEqual(readGroups(join(tmpdir(), "no-such-groupings-note.md")), []);
});
