import assert from "node:assert/strict";
import test from "node:test";
import { PREP_TOOLS, prepHandoffMessage, prepMessage, prepStatus, prepSystemPrompt } from "./prep.ts";
import { escalationMessage } from "./prompts.ts";
import type { PreparationPacket } from "../../../../tools/agent/campaign/packet.ts";
import type { PrepHandoffSummary } from "./types.ts";

test("prep uses a short skill and limited tools without replacing project constraints", () => {
  const prompt = prepMessage("func_80012345", "Measured source: build/prep/draft.c");
  assert.match(prompt, /include\/globals_override\.h/);
  assert.match(prompt, /Measured source: build\/prep\/draft.c/);
  assert.doesNotMatch(prompt, /psx-decompile-function|KEEP_GOING/);
  assert.equal(PREP_TOOLS.includes("psx_finalize_function"), false);
  const system = prepSystemPrompt({ cwd: "/project", contextFiles: [{ path: "AGENTS.md", content: "Keep the source policy" }],
    skills: [{ name: "solver-skill", description: "solver", filePath: "x", baseDir: "x", disableModelInvocation: false,
      sourceInfo: { path: "x", source: "project", scope: "project", origin: "top-level" } }] });
  assert.match(system, /Keep the source policy/);
  assert.doesNotMatch(system, /solver-skill/);
});

test("prep has a dedicated handoff and the matching tier receives its candidate and packet", () => {
  const request = prepHandoffMessage("func_80012345");
  assert.match(request, /psx_loop_prep_handoff/);
  assert.doesNotMatch(request, /\bpsx_loop_handoff\b|whatWasTried|currentDivergence/);
  const summary: PrepHandoffSummary = { functionName: "func_80012345", candidatePath: "build/prep/draft.c",
    headerChanges: "include/globals_override.h", sdkIdioms: "setPolyF4", compilation: "cpp, cc1, assembler succeeded",
    unresolved: "", source: "tool" };
  const message = escalationMessage(summary.functionName, "matcher", "Compilation succeeded", undefined, "Refreshed context: build/prep/context.c", summary);
  assert.match(message, /Preparation handoff/);
  assert.match(message, /build\/prep\/draft.c/);
  assert.match(message, /Refreshed context: build\/prep\/context.c/);
  assert.match(message, /include\/globals_override\.h/);
  assert.match(message, /setPolyF4/);
  assert.doesNotMatch(message, /previous escalation tier did not reach a match/);
});

test("prep completion requires compiling C and published context, not byte exactness", () => {
  const packet = { primary: { path: "build/prep/draft.c" }, identity: { destination: "src/func_80012345.c" },
    compilation: { status: "succeeded", diagnostics: "" }, comparison: { status: "mismatching" },
    integration: { state: "staged", blockers: [] } } as unknown as PreparationPacket;
  assert.equal(prepStatus(packet).ready, true);
  packet.compilation.status = "failed";
  assert.equal(prepStatus(packet).ready, false);
  packet.compilation.status = "succeeded";
  packet.compilation.diagnostics = "warning: assignment from incompatible pointer type";
  assert.equal(prepStatus(packet).ready, false);
  packet.compilation.diagnostics = "";
  packet.integration.blockers = ["source-local types require explicit declaration integration"];
  assert.equal(prepStatus(packet).ready, false);
  packet.integration.blockers = ["no clean-C target definition"];
  assert.equal(prepStatus(packet).ready, false);
});
