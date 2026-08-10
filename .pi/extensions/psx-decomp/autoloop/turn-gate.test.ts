import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { archiveSource } from "./park.ts";
import { createTurnGate, waitForTurn, type TurnWaitResult } from "./turn-gate.ts";

/**
 * A scripted session. Each poll advances one step of `script`, where a step says
 * whether the session is busy on that tick and whether a run settled on it.
 * `waitForIdle` resolves once the script has no busy step left.
 */
function drive(
  script: { busy: boolean; settle?: boolean }[],
  options: { startTimeoutMs?: number; abortAt?: number } = {},
) {
  const gate = createTurnGate();
  const before = gate.settled;
  let tick = 0;
  let clock = 0;
  let idleWaits = 0;
  const step = () => script[Math.min(tick, script.length - 1)];

  const result = waitForTurn({
    gate,
    before,
    isIdle: () => !(step()?.busy ?? false),
    isAborted: () => options.abortAt !== undefined && tick >= options.abortAt,
    waitForIdle: async () => {
      idleWaits += 1;
      tick = script.length;
    },
    startTimeoutMs: options.startTimeoutMs ?? 1000,
    pollMs: 100,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
      tick += 1;
      if (step()?.settle) gate.settled += 1;
    },
  });
  return { result, gate, idleWaits: () => idleWaits };
}

test("a turn that runs to completion is reported settled", async () => {
  const { result, idleWaits } = drive([{ busy: false }, { busy: true }, { busy: true }, { busy: false }]);
  assert.equal(await result, "settled" satisfies TurnWaitResult);
  assert.equal(idleWaits(), 1);
});

test("a message that never becomes a run is not scored as a completed turn", async () => {
  const { result, idleWaits } = drive([{ busy: false }], { startTimeoutMs: 300 });
  assert.equal(await result, "never-started" satisfies TurnWaitResult);
  assert.equal(idleWaits(), 0);
});

test("a long turn is never mistaken for one that never started", async () => {
  /* Busy from the second poll on, long past the start deadline. */
  const script = [{ busy: false }, ...Array.from({ length: 40 }, () => ({ busy: true }))];
  const { result } = drive(script, { startTimeoutMs: 300 });
  assert.equal(await result, "settled" satisfies TurnWaitResult);
});

test("a run whose start is missed between polls still counts, because the counter also decides", async () => {
  /* Never observed busy: it began and ended inside one poll interval. */
  const { result, idleWaits } = drive([{ busy: false }, { busy: false, settle: true }], { startTimeoutMs: 10_000 });
  assert.equal(await result, "settled" satisfies TurnWaitResult);
  assert.equal(idleWaits(), 0, "a settled run needs no further idle wait");
});

test("an abort stops the wait instead of waiting out the turn", async () => {
  const { result } = drive([{ busy: false }, ...Array.from({ length: 20 }, () => ({ busy: false }))], {
    abortAt: 3,
    startTimeoutMs: 10_000,
  });
  assert.equal(await result, "aborted" satisfies TurnWaitResult);
});

test("an abort raised while the turn was running is reported, not swallowed", async () => {
  const gate = createTurnGate();
  let aborted = false;
  const result = await waitForTurn({
    gate,
    before: gate.settled,
    isIdle: () => false,
    isAborted: () => aborted,
    waitForIdle: async () => {
      aborted = true;
    },
    startTimeoutMs: 1000,
    pollMs: 100,
    now: () => 0,
    sleep: async () => {},
  });
  assert.equal(result, "aborted" satisfies TurnWaitResult);
});

test("a settle counted before this message was sent does not satisfy the wait", async () => {
  const gate = createTurnGate();
  gate.settled = 7;
  let polls = 0;
  let clock = 0;

  const result = await waitForTurn({
    gate,
    before: 7,
    isIdle: () => true,
    isAborted: () => false,
    waitForIdle: async () => assert.fail("the counter should have ended the wait"),
    startTimeoutMs: 10_000,
    pollMs: 100,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
      polls += 1;
      if (polls === 3) gate.settled += 1;
    },
  });
  assert.equal(result, "settled");
  assert.equal(polls, 3);
});

test("archiving keeps a copy of source the loop is about to overwrite", () => {
  const dir = mkdtempSync(join(tmpdir(), "autoloop-archive-"));
  try {
    const path = archiveSource(dir, "func_80012345", "int main(void) { return 0; }\n", "parked", "2026-08-09T01:02:03.456Z");
    assert.ok(path);
    assert.equal(readFileSync(path, "utf8"), "int main(void) { return 0; }\n");
    assert.deepEqual(readdirSync(join(dir, "attempts")), ["func_80012345.2026-08-09T01-02-03-456Z.parked.c"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("archiving an empty source writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "autoloop-archive-"));
  try {
    assert.equal(archiveSource(dir, "func_80012345", "   \n", "parked", "2026-08-09T00:00:00.000Z"), undefined);
    assert.equal(readdirSync(dir).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
