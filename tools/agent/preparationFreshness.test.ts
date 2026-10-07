import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packetIsFresh, hashFile, stagePrepared } from "./prepareFunction.js";
import { configuredToolchainIdentity } from "./decompToolchain.js";
import type { PreparationPacket } from "./campaign/packet.js";

test("packet freshness separates ledger diagnostics while checking artifacts and discovery membership", (t) => {
  const root = mkdtempSync(join(tmpdir(), "preparation-freshness-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["src", "build", "include"]) mkdirSync(join(root, dir));
  for (const [p, value] of [["src/f.c", "void f(void) {}\n"], ["include/common.h", "/* input */"], ["build/draft.c", "void f(void) { }\n"],
    ["build/raw.c", "void f(void) { }\n"], ["build/f.i", "cpp"], ["build/f.s", "assembly"], ["build/f.o", "object"]]) writeFileSync(join(root, p!), value!);
  const artifact = (path: string) => ({ path, sha256: hashFile(join(root, path)) });
  const packet = { schemaVersion: 1, identity: { inputs: { "src/f.c": hashFile(join(root, "src/f.c")), "include/common.h": hashFile(join(root, "include/common.h")) },
    memberships: { src: ["src/f.c"] }, tools: configuredToolchainIdentity() },
    primary: { ...artifact("build/draft.c"), text: readFileSync(join(root, "build/draft.c"), "utf8"), origin: "m2c" },
    compilation: { preprocessed: artifact("build/f.i"), assembly: artifact("build/f.s"), object: artifact("build/f.o") },
    generation: { raw: "build/raw.c", rawHash: hashFile(join(root, "build/raw.c")) } } as unknown as PreparationPacket;
  assert.equal(packetIsFresh(packet, root), true);
  assert.equal(packetIsFresh({} as PreparationPacket, root), false);
  writeFileSync(join(root, "build/ledger.jsonl"), "new diagnostic\n"); assert.equal(packetIsFresh(packet, root), true);
  writeFileSync(join(root, "src/newly-available.c"), "void other(void) {}\n"); assert.equal(packetIsFresh(packet, root), false);
  rmSync(join(root, "src/newly-available.c")); assert.equal(packetIsFresh(packet, root), true);
  for (const path of ["src/f.c", "include/common.h", "build/draft.c", "build/raw.c", "build/f.i", "build/f.s", "build/f.o"]) {
    const previous = readFileSync(join(root, path)); writeFileSync(join(root, path), "changed");
    assert.equal(packetIsFresh(packet, root), false, path); writeFileSync(join(root, path), previous);
  }
});

test("staging independently refuses unverified/incomplete chain packets even without generic blockers", () => {
  const packet = { primary: { origin: "m2c" }, compilation: { status: "succeeded" }, integration: { blockers: [] },
    discovery: { staticChain: { status: "pending-oracle" } } } as unknown as PreparationPacket;
  for (const status of ["pending-oracle", "failed", "incomplete"] as const) {
    packet.discovery.staticChain!.status = status;
    assert.deepEqual(stagePrepared(packet), { staged: false, reason: "static-chain claims or scaffold are not verified" });
  }
});
