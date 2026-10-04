import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyDeclarationIndex } from "../../../../tools/agent/declarationContext.ts";
import { configuredToolchainIdentity } from "../../../../tools/agent/decompToolchain.ts";
import { hashText, packetIsFresh, stagePrepared } from "../../../../tools/agent/prepareFunction.ts";
import { packetOpening, type PreparationPacket } from "../../../../tools/agent/campaign/packet.ts";
import { attemptStaticFinalization, buildInputs, documentCompletion, inputIdentity, sameInputs, type Completion } from "./prepared-attempt.ts";

function fixture(t: { after: (f: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "prepared-lifecycle-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["src", "include", "configs", "build/draft"]) mkdirSync(join(root, dir), { recursive: true });
  const stub = '#include "common.h"\nINCLUDE_ASM("build/asm/nonmatchings/f", f);\n';
  const text = "void f(void) {}\n";
  writeFileSync(join(root, "src/f.c"), stub); writeFileSync(join(root, "build/draft/f.c"), text);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q"); git("add", "src");
  const tree = git("write-tree");
  const commit = git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit-tree", tree, "-m", "isolated fixture"); git("update-ref", "HEAD", commit);
  const packet: PreparationPacket = {
    schemaVersion: 1, identity: { functionName: "f", container: "ovl_1", destination: "src/f.c", assembly: "original/f.s", data: [], inputs: { "src/f.c": hashText(stub) }, fingerprint: "fixture", tools: configuredToolchainIdentity(), flags: [] },
    primary: { origin: "m2c", path: "build/draft/f.c", sha256: hashText(text), text, declarationsRequired: [] },
    context: { index: emptyDeclarationIndex(), projection: "build/context.c", excluded: [], unknown: [], headers: ["common.h"] },
    generation: { status: "generated" }, compilation: { status: "succeeded", commands: [], diagnostics: "warning: retained" }, comparison: { status: "exact" },
    integration: { state: "staged", changes: ["src/f.c"], destinationHash: hashText(stub), blockers: [] },
    discovery: { unknowns: [], report: null, priorExperiments: [], preflight: [] }, finalization: { status: "not-attempted" },
  };
  return { root, stub, packet, attempt: { packet, path: "build/draft/packet.json" } };
}
test("an exact draft is CAS-staged and finalized without a solver, then documentation resumes by identity", async (t) => {
  const { root, packet, attempt } = fixture(t); let gates = 0;
  const result = await attemptStaticFinalization({ root, attempt, aborted: () => false,
    finalize: async () => { gates++; assert.equal(readFileSync(join(root, "src/f.c"), "utf8"), packet.primary!.text); return { passed: true, changedFiles: ["src/f.c"], detail: "all gates" }; } });
  assert.equal(gates, 1); assert.equal(result.completed!.origin, "static"); assert.equal(result.completed!.documentation, "pending");
  let turns = 0;
  const documented = await documentCompletion(root, result.completed!, async () => { turns++; return true; });
  assert.equal(documented.documentation, "passed");
  await documentCompletion(root, documented, async () => { turns++; return true; }); assert.equal(turns, 1);
});
test("noncompiling output and failed generation have useful handoffs, never residuals or writes", async (t) => {
  const { root, stub, packet, attempt } = fixture(t); packet.compilation.status = "failed"; packet.comparison.status = "not-available";
  packet.integration.blockers.push("parse failed"); packet.primary!.text = "void f(?)";
  const result = await attemptStaticFinalization({ root, attempt, aborted: () => false, finalize: async () => { throw new Error("must not run"); } });
  assert.match(result.handoff, /Measured source: build\/draft\/f.c/); assert.match(result.handoff, /Live destination: src\/f.c/); assert.match(result.handoff, /void f\(\?\)/);
  assert.equal(readFileSync(join(root, "src/f.c"), "utf8"), stub);
  packet.primary = null; packet.generation.status = "failed";
  assert.match(packetOpening(packet, attempt.path), /none — generation failed/);
});
test("failed finalization restores only the preparer's own staging", async (t) => {
  const { root, stub, packet, attempt } = fixture(t);
  const result = await attemptStaticFinalization({ root, attempt, aborted: () => false, finalize: async () => ({ passed: false, changedFiles: [], detail: "full build failed" }) });
  assert.equal(result.completed, undefined); assert.equal(packet.finalization.gate, "full build failed");
  assert.equal(readFileSync(join(root, "src/f.c"), "utf8"), stub); assert.equal(packetIsFresh(packet, root), true);
});
test("concurrent source edits after staging are never reset", async (t) => {
  const { root, packet, attempt } = fixture(t);
  await attemptStaticFinalization({ root, attempt, aborted: () => false, finalize: async () => {
    writeFileSync(join(root, "src/f.c"), "/* concurrent user work */\n"); return { passed: false, changedFiles: [], detail: "failure" };
  } });
  assert.match(readFileSync(join(root, "src/f.c"), "utf8"), /concurrent user work/);
  assert.ok(packet.integration.blockers.some((x) => x.includes("concurrent")));
});
test("stale packets, dirty destinations and edited drafts refuse staging", (t) => {
  const { root, packet } = fixture(t);
  writeFileSync(join(root, "build/draft/f.c"), "/* edited draft */\n"); assert.equal(stagePrepared(packet, root).staged, false);
  writeFileSync(join(root, "build/draft/f.c"), packet.primary!.text);
  writeFileSync(join(root, "src/f.c"), "/* user work */\n"); assert.equal(stagePrepared(packet, root).staged, false);
});
test("cancellation before integration makes zero finalization calls", async (t) => {
  const { root, stub, attempt } = fixture(t);
  const result = await attemptStaticFinalization({ root, attempt, aborted: () => true, finalize: async () => { throw new Error("must not run"); } });
  assert.equal(result.completed, undefined); assert.equal(readFileSync(join(root, "src/f.c"), "utf8"), stub);
});
test("documentation failure remains pending; source/header drift explicitly invalidates verification", async (t) => {
  const { root } = fixture(t); const inputs = buildInputs(root);
  const c: Completion = { origin: "agent", inputs, verifiedIdentity: inputIdentity(inputs), documentation: "pending", changedFiles: [] };
  assert.equal((await documentCompletion(root, c, async () => false)).documentation, "pending");
  const drift = await documentCompletion(root, c, async () => { writeFileSync(join(root, "include/new.h"), "typedef int Unexpected;\n"); return true; });
  assert.equal(drift.documentation, "pending"); assert.equal(drift.verification, "invalidated");
  assert.match(drift.error!, /finalization must be rerun/);
});
test("input identity is independent of traversal/property order", () => {
  assert.ok(sameInputs({ a: "1", b: "2" }, { b: "2", a: "1" }));
});
