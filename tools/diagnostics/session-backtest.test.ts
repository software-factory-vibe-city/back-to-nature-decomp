import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSession, classifyCall } from "./sessionBacktest.js";
const entry = (id: string, parentId: string | null, message: unknown) => JSON.stringify({ type: "message", id, parentId, timestamp: `2026-01-01T00:00:00Z`, message });
const user = (id: string, parent: string | null, text: string) => entry(id, parent, { role: "user", content: [{ type: "text", text }] });
const assistant = (id: string, parent: string, calls: unknown[] = []) => entry(id, parent, { role: "assistant", content: calls });
const call = (id: string, name: string, args = {}) => ({ type: "toolCall", id, name, arguments: args });
const result = (id: string, parent: string, callId: string, text: string, isError = false) => entry(id, parent, { role: "toolResult", toolCallId: callId, content: [{ type: "text", text }], isError });
test("branch visits and documentation stay attributed through shuffled/delayed results", () => {
  const rows = [user("a", null, "Target: func_80010000"), assistant("b", "a", [call("c1", "functions.psx_m2c")]),
    user("d", "a", "Target: ovl_1_func_80020000"), assistant("e", "d", [call("c2", "psx_finalize_function")]),
    result("f", "b", "c1", "raw source"), user("g", "f", "func_80010000 has passed the full finalize gate"), assistant("h", "g"),
    result("i", "e", "c2", "Gate failed")];
  const report = extractSession([rows[5], rows[7], ...rows.slice(0, 5), rows[6], rows[8]].join("\n"));
  assert.equal(report.attempts.length, 2); assert.equal(report.branchPoints.length, 1);
  const first = report.attempts.find((a) => a.target === "func_80010000")!;
  assert.equal(first.solverTurns, 1); assert.equal(first.documentationTurns, 1);
  assert.equal(report.calls.find((c) => c.id === "c1")!.results[0]!.text, "raw source");
  assert.equal(report.boundaries.length, 0);
});
test("multiple calls, duplicate returns, missing/truncated results and queued selection remain visible", () => {
  const rows = [user("a", null, "Target: func_80010000"), assistant("b", "a", [call("c1", "write", { path: "src/f.c", content: "partial" }), call("c2", "edit"), call("c3", "read")]),
    result("r1", "b", "c1", "write failed", true), result("r2", "r1", "c1", "write failed", true), result("r3", "r2", "c3", "Output truncated"),
    user("queued", "r3", "Target: func_80020000"), '{"type":'];
  const report = extractSession(rows.join("\n"));
  assert.equal(report.calls[0]!.evidence, "duplicate"); assert.equal(report.calls[1]!.evidence, "missing");
  assert.equal(report.calls[2]!.evidence, "truncated"); assert.equal(report.attempts[0]!.reproducibility.observed, false);
  assert.deepEqual(report.queued, ["queued"]); assert.equal(report.incomplete.length, 1);
});
test("a resumed target, ambiguous boundaries, wrapped calls and textual mentions are not conflated", () => {
  const report = extractSession([user("a", null, "Target: func_80010000"), assistant("b", "a"), user("c", "b", "Target: func_80010000"),
    assistant("d", "c", [call("wrap", "multi_tool_use.parallel", { tool_uses: [{ recipient_name: "functions.read", parameters: { path: "include/x.h" } }] })]),
    user("e", "d", "Target: func_80020000\nTarget: func_80030000")].join("\n"));
  assert.equal(report.attempts[1]!.resumedFrom, "a"); assert.equal(report.boundaries[0]!.reason, "multiple explicit targets");
  assert.equal(report.calls[0]!.name, "read"); assert.equal(report.calls[0]!.id, "wrap:0");
  assert.equal(classifyCall({ name: "bash", args: { command: 'echo "npx tsx tools/agent/m2cFunc.ts f"' } }), "other");
  assert.equal(classifyCall({ name: "bash", args: { command: 'rg repairM2c tools' } }), "other");
  assert.equal(classifyCall({ name: "bash", args: { command: 'npx tsx tools/agent/m2cFunc.ts f' } }), "raw-m2c");
});
