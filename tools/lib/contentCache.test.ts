import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshot, readCache, writeCache, writeIfChanged, digest } from "./contentCache.js";

test("content identities track missing files, edits and directory membership", (t) => {
  const root = mkdtempSync(join(tmpdir(), "content-cache-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const absent = snapshot(root, ["headers"]); assert.equal(absent.headers, "absent");
  mkdirSync(join(root, "headers")); const empty = snapshot(root, ["headers"]); assert.notDeepEqual(empty, absent);
  writeFileSync(join(root, "headers/a.h"), "a"); const added = snapshot(root, ["headers"]); assert.notDeepEqual(added, empty);
  writeFileSync(join(root, "headers/a.h"), "b"); const edited = snapshot(root, ["headers"]);
  assert.equal(edited["headers/#membership"], added["headers/#membership"]); assert.notDeepEqual(edited, added);
  rmSync(join(root, "headers/a.h")); assert.deepEqual(snapshot(root, ["headers"]), empty);
});
test("identical publication preserves mtime and interrupted/corrupt envelopes miss", (t) => {
  const root = mkdtempSync(join(tmpdir(), "atomic-cache-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "cache.json"), key = digest("inputs");
  writeCache(path, key, { a: [1] }); const time = statSync(path).mtimeMs;
  writeCache(path, key, { a: [1] }); assert.equal(statSync(path).mtimeMs, time);
  const first = readCache<{ a: number[] }>(path, key)!; first.a.push(2);
  assert.deepEqual(readCache(path, key), { a: [1] }); assert.equal(readCache(path, "other"), undefined);
  writeFileSync(path, '{"schema":1'); assert.equal(readCache(path, key), undefined);
  writeFileSync(path, JSON.stringify({ schema: 1, key, value: "forged", valueHash: key })); assert.equal(readCache(path, key), undefined);
  assert.equal(writeIfChanged(path, "fixed"), true); assert.equal(writeIfChanged(path, "fixed"), false);
});
