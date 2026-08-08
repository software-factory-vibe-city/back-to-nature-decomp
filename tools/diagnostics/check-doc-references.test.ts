import assert from "node:assert/strict";
import test from "node:test";
import { findReferences } from "./checkDocReferences.ts";

const DIRECTORIES = ["configs", "include", "notes", "src", "tools"];

function paths(source: string): string[] {
  return findReferences(source, "notes/example.md", DIRECTORIES)
    .filter((reference) => reference.kind === "path")
    .map((reference) => reference.reference);
}

test("a repository path in prose is a reference", () => {
  assert.deepEqual(
    paths("deleted both `tools/build/fixSmallDataExterns.ts` and `configs/tu_externs.txt`."),
    ["tools/build/fixSmallDataExterns.ts", "configs/tu_externs.txt"],
  );
});

test("a version component is not a file extension", () => {
  /* `build-gcc-2.95.2-psx` ends in a version, and reading `.2` as an extension
   * invents a path nobody wrote — which then reports as a stale reference. */
  assert.deepEqual(paths("Compiler at tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1 is built."), []);
});

test("documentation placeholders are notation, not references", () => {
  assert.deepEqual(paths("Replace the stub in `src/FUNC.c` with the C code"), []);
  assert.deepEqual(paths("write it to src/<function>.c first"), []);
});

test("a basename already named by a path on the same line is one reference", () => {
  const found = findReferences("see tools/agent/diffFunc.ts for the oracle", "notes/example.md", DIRECTORIES);
  assert.deepEqual(found.map((reference) => reference.kind), ["path"]);
});

test("a bare tool filename is reported separately from a path", () => {
  const found = findReferences("fixSmallDataExterns.ts widens the .extern", "src/example.c", DIRECTORIES);
  assert.deepEqual(
    found.map((reference) => [reference.kind, reference.reference]),
    [["basename", "fixSmallDataExterns.ts"]],
  );
});

test("references carry the line they were found on", () => {
  const found = findReferences("one\ntwo\nsee configs/tu_externs.txt\n", "notes/example.md", DIRECTORIES);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.line, 3);
});
