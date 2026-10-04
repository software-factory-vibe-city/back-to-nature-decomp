import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { git } from "../agent/resource-extraction/git.ts";
import { executeResource, loadRun } from "../agent/resource-extraction/pipeline.ts";
import { analyzerVersion, Store } from "../agent/resource-extraction/storage.ts";
import { recoverAbandonedResourceLocks } from "./resourceLocks.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "resource-lock-")), store = new Store(root);
  mkdirSync(store.path("locks"), { recursive: true });
  const child = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  assert.equal(child.status, 0);
  return { root, store, exitedPid: child.pid!, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("resource tools recover locks whose owners exited, without removing live locks or artifacts", async () => {
  const f = fixture();
  try {
    f.store.atomic("locks/asset-identification.lock", `${f.exitedPid}\n`);
    f.store.atomic("locks/active.lock", `${process.pid}\n`);
    f.store.atomic("blobs/preserved", "verified bytes");
    const analyzer = analyzerVersion();
    assert.deepEqual(recoverAbandonedResourceLocks(f.root), ["asset-identification.lock"]);
    assert.equal(existsSync(f.store.path("locks/asset-identification.lock")), false);
    assert.equal(readFileSync(f.store.path("locks/active.lock"), "utf8"), `${process.pid}\n`);
    assert.equal(readFileSync(f.store.path("blobs/preserved"), "utf8"), "verified bytes");
    assert.equal(analyzerVersion(), analyzer);
    assert.equal(await f.store.lock("asset-identification", async () => "continued"), "continued");
    await assert.rejects(f.store.lock("active", async () => "must not enter"), /locked/);
    assert.deepEqual(recoverAbandonedResourceLocks(f.root), []);
  } finally { f.done(); }
});

test("uncertain owners and permission failures are not treated as exited processes", () => {
  const f = fixture(), kill = process.kill;
  try {
    for (const [name, owner] of [["empty", ""], ["invalid", "NaN"], ["group", "0"], ["negative", "-1"]]) f.store.atomic(`locks/${name}.lock`, owner!);
    f.store.atomic("locks/restricted.lock", `${process.pid}\n`);
    process.kill = () => { throw Object.assign(new Error("not permitted"), { code: "EPERM" }); };
    assert.deepEqual(recoverAbandonedResourceLocks(f.root), []);
    assert(existsSync(f.store.path("locks/restricted.lock")));
  } finally { process.kill = kill; f.done(); }
});

test("a lock whose ownership changed during the check is left untouched", () => {
  const f = fixture(), kill = process.kill;
  try {
    f.store.atomic("locks/changing.lock", `${f.exitedPid}\n`);
    process.kill = () => {
      f.store.atomic("locks/changing.lock", `${process.pid}\n`);
      throw Object.assign(new Error("old owner exited"), { code: "ESRCH" });
    };
    assert.deepEqual(recoverAbandonedResourceLocks(f.root), []);
    assert.equal(readFileSync(f.store.path("locks/changing.lock"), "utf8"), `${process.pid}\n`);
  } finally { process.kill = kill; f.done(); }
});

test("the real asset-commit CLI automatically recovers an abandoned lock and completes its gate", async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, ".gitignore"), "build/\nextracted/\n");
    writeFileSync(join(f.root, "package.json"), '{"type":"module"}\n');
    git(f.root, ["init", "-q"]); git(f.root, ["config", "user.name", "Lock Test"]); git(f.root, ["config", "user.email", "test@example.invalid"]);
    git(f.root, ["config", "commit.gpgsign", "false"]); git(f.root, ["add", "."]); git(f.root, ["commit", "-qm", "fixture"]);
    mkdirSync(join(f.root, "extracted"));
    const bytes = Buffer.alloc(22);
    bytes.writeUInt32LE(16); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(14, 8); bytes.writeUInt16LE(1, 16); bytes.writeUInt16LE(1, 18);
    writeFileSync(join(f.root, "extracted/resource"), bytes);
    const campaign = await executeResource("campaign", f.root);
    const node = loadRun(f.store, campaign.run as string).manifest.nodes.find(n => n.kind === "resource")!;
    f.store.atomic("locks/asset-identification.lock", `${f.exitedPid}\n`);
    f.store.json("request.json", { action: "asset", run: campaign.run, node: node.id, commit: true });
    const command = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), fileURLToPath(new URL("../agent/resourceIteration.ts", import.meta.url)), "--request", "request.json"], { cwd: f.root, encoding: "utf8" });
    assert.equal(command.status, 0, command.stderr);
    assert.match(command.stdout, /"outcome":"asset-committed"/);
    assert.equal(git(f.root, ["show", "--format=", "--name-only", "HEAD"]), "notes/asset-identification.md");
    assert.equal(existsSync(f.store.path("locks/asset-identification.lock")), false);
  } finally { f.done(); }
});
