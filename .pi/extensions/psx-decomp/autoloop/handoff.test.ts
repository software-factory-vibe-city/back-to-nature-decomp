import assert from "node:assert/strict";
import test from "node:test";
import { lastAssistantText } from "./handoff.ts";
import { escalationMessage, handoffBlock, handoffMessage } from "./prompts.ts";
import type { HandoffSummary } from "./types.ts";

const SUMMARY: HandoffSummary = {
  functionName: "func_80012345",
  whatWasTried: "swapped the two store statements; no change to the diff",
  ruledOut: "arity 3 — frame map shows a 0x10 outgoing area, so there are two stack arguments",
  currentDivergence: "0x80012360: target sra $v0,$v0,12, candidate srl",
  leadingHypothesis: "the shift operand is signed; try s32 rather than u32 for the accumulator",
  source: "tool",
};

test("the handoff request asks for measurements, not for hunches", () => {
  const message = handoffMessage("func_80012345");
  assert.match(message, /psx_loop_handoff/);
  assert.match(message, /whatWasTried/);
  assert.match(message, /ruledOut/);
  assert.match(message, /currentDivergence/);
  assert.match(message, /leadingHypothesis/);
  assert.match(message, /traceable to an assembly line or a tool that measured it/);
  assert.match(message, /Do not edit any\nfiles in this turn/);
});

test("a structured handoff is rendered field by field", () => {
  const block = handoffBlock(SUMMARY);
  assert.match(block, /What was tried: swapped the two store statements/);
  assert.match(block, /Ruled out: arity 3/);
  assert.match(block, /Current divergence: 0x80012360/);
  assert.match(block, /Leading hypothesis: the shift operand is signed/);
});

test("the receiving tier is told to treat the handoff adversarially", () => {
  const block = handoffBlock(SUMMARY);
  assert.match(block, /Treat this analysis adversarially and with skepticism/);
  assert.match(block, /at least one premise in it is likely wrong/);
  assert.match(block, /the assembly\nwins/);
  assert.match(block, /Check the evidence, not the verdict/);
});

test("a scraped prose handoff carries the same caveat without inventing fields", () => {
  const block = handoffBlock({ ...SUMMARY, source: "prose", whatWasTried: "I think it is a signedness bug." });
  assert.match(block, /I think it is a signedness bug\./);
  assert.equal(block.includes("Ruled out:"), false);
  assert.match(block, /Treat this analysis adversarially and with skepticism/);
});

test("the escalation message carries the handoff only when there is one", () => {
  const without = escalationMessage("func_80012345", "kimi-k3", "Oracle: MISMATCH");
  assert.equal(without.includes("Handoff from the previous escalation tier"), false);

  const with_ = escalationMessage("func_80012345", "kimi-k3", "Oracle: MISMATCH", SUMMARY);
  assert.match(with_, /Mode: resume\/fix/);
  assert.match(with_, /Handoff from the previous escalation tier/);
  assert.match(with_, /Treat this analysis adversarially/);
  assert.ok(with_.indexOf("Oracle: MISMATCH") < with_.indexOf("Handoff from the previous"));
});

test("the prose fallback reads the newest assistant text and skips thinking and tool calls", () => {
  const ctx = {
    sessionManager: {
      getEntries: () => [
        { type: "message", message: { role: "user", content: [{ type: "text", text: "go" }] } },
        { type: "message", message: { role: "assistant", content: [{ type: "text", text: "older" }] } },
        {
          type: "message",
          message: {
            role: "assistant",
            content: [
              { type: "thinking", thinking: "not this" },
              { type: "text", text: "the summary" },
              { type: "toolCall", name: "read" },
            ],
          },
        },
        { type: "thinking_level_change", thinkingLevel: "high" },
      ],
    },
  };
  assert.equal(lastAssistantText(ctx as never), "the summary");
});

test("the prose fallback returns nothing when the tier said nothing", () => {
  const ctx = { sessionManager: { getEntries: () => [] } };
  assert.equal(lastAssistantText(ctx as never), "");
});
