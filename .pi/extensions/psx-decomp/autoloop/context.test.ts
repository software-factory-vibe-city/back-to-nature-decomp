import assert from "node:assert/strict";
import test from "node:test";
import { needsCompaction, requestCompaction, type CompactionHandlers } from "./context.ts";

const reading = (tokens: number | null) => ({ tokens, contextWindow: 1_000_000, percent: null });

test("the ceiling triggers at the threshold and not below it", () => {
  assert.equal(needsCompaction(reading(349_999), 350_000), false);
  assert.equal(needsCompaction(reading(350_000), 350_000), true);
  assert.equal(needsCompaction(reading(900_000), 350_000), true);
});

test("a threshold of zero turns the ceiling off", () => {
  assert.equal(needsCompaction(reading(900_000), 0), false);
  assert.equal(needsCompaction(reading(900_000), -1), false);
});

test("an absent or unknown reading never triggers a compaction", () => {
  assert.equal(needsCompaction(undefined, 350_000), false);
  assert.equal(needsCompaction(reading(null), 350_000), false);
});

/** A sleep that never resolves: the timeout must lose whenever a result arrives. */
const never = () => new Promise<void>(() => {});

test("a reported completion resolves the request", async () => {
  const result = await requestCompaction({
    compact: (handlers: CompactionHandlers) => handlers.onComplete(),
    timeoutMs: 1000,
    sleep: never,
  });
  assert.deepEqual(result, { outcome: "compacted", detail: "" });
});

test("a reported error is carried back rather than thrown", async () => {
  const result = await requestCompaction({
    compact: (handlers: CompactionHandlers) => handlers.onError(new Error("summarizer refused")),
    timeoutMs: 1000,
    sleep: never,
  });
  assert.equal(result.outcome, "failed");
  assert.match(result.detail, /summarizer refused/);
});

test("a compaction that throws on the spot is a failure, not an escaped exception", async () => {
  const result = await requestCompaction({
    compact: () => {
      throw new Error("no compaction in this mode");
    },
    timeoutMs: 1000,
    sleep: never,
  });
  assert.equal(result.outcome, "failed");
  assert.match(result.detail, /no compaction in this mode/);
});

test("a compaction that never reports times out instead of stalling the loop", async () => {
  const result = await requestCompaction({
    compact: () => {},
    timeoutMs: 1000,
    sleep: async () => {},
  });
  assert.equal(result.outcome, "timed-out");
  assert.match(result.detail, /1000ms/);
});

test("a late second report cannot change an outcome already returned", async () => {
  let handlers: CompactionHandlers | undefined;
  const result = await requestCompaction({
    compact: (given: CompactionHandlers) => {
      handlers = given;
      given.onComplete();
    },
    timeoutMs: 1000,
    sleep: never,
  });
  assert.equal(result.outcome, "compacted");
  handlers?.onError(new Error("too late"));
  assert.equal(result.outcome, "compacted");
});
