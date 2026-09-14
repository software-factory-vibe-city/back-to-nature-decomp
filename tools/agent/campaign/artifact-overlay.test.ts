/**
 * The recovered-artifact overlay, and the loop it closes.
 *
 * A campaign that learns nothing from its own successes is not a fixed point,
 * and the way it fails is invisible: the donor index and the signature resolver
 * ask `src/`, a campaign may not write `src/`, so a function recovered
 * byte-exactly five seconds ago is still, to every consumer, a stub with no C
 * and no declared interface. Its family gains no donor. Its callers see an ABI
 * floor. The next round asks the same question and gets the same answer.
 *
 * Two claims are held here. The overlay's own invariant — **nothing enters
 * unverified** — because an overlay of plausible drafts would feed guesses to
 * the consumers that exist to tell evidence from guesses. And the loop itself,
 * end to end and in cold context, where the only thing that changed between the
 * failing attempt and the succeeding one is what this run recovered from the
 * binary.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { withContextMode } from "../matching-reconstruction/context-mode.js";
import { reconstructFunction } from "../matching-reconstruction/engine.js";
import { buildFamilyIndex, donorsFor } from "../family-transfer/family-index.js";
import {
  loadOverlay,
  overlayRevision,
  overlaySourceFor,
  publishRecovered,
  retractRecovered,
  visibleEntries,
} from "./artifact-overlay.js";
import { runFeedbackExperiment } from "../../diagnostics/feedbackLoop.js";

/* A private overlay: the test files run in separate processes and the overlay
 * is shared mutable state, so publishing in one would land in another's
 * measurement. */
process.env["PSX_OVERLAY_ROOT"] = join(ROOT, "build/testOverlay/overlayTest");

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

/** A function the constructor recovers from the words alone, cold. */
const PRODUCER = "ovl_21_func_800BA670";
/** Its cross-container sibling, whose whole domain the constructor exhausts. */
const DEPENDENT = "ovl_11_func_800F4114";

/* ---- nothing enters unverified --------------------------------------------- */

projectTest("a source that does not reproduce the target is refused", () => {
  retractRecovered();
  const result = publishRecovered(PRODUCER, `void ${PRODUCER}(void) { }\n`, "reconstruction");
  assert.ok("refused" in result, "compiling is not the bar; matching is");
  assert.match((result as { refused: string }).refused, /oracle says/);
  assert.equal(visibleEntries().length, 0);
});

projectTest("a source that does not compile is refused", () => {
  retractRecovered();
  const result = publishRecovered(PRODUCER, "this is not C\n", "reconstruction");
  assert.ok("refused" in result);
  assert.match((result as { refused: string }).refused, /does not compile/);
});

projectTest("a source containing assembly is refused before it is compiled", () => {
  retractRecovered();
  const result = publishRecovered(PRODUCER, `INCLUDE_ASM("asm", ${PRODUCER});\n`, "reconstruction");
  assert.ok("refused" in result);
  assert.match((result as { refused: string }).refused, /include-asm/);
});

projectTest("a verified recovery is published and readable back", () => {
  retractRecovered();
  const recovered = withContextMode("cold", () => reconstructFunction({ functionName: PRODUCER, notify: () => {} }));
  assert.equal(recovered.state, "exact-candidate", recovered.unresolved?.detail);
  const result = publishRecovered(PRODUCER, recovered.winner!.source, "reconstruction");
  assert.ok(!("refused" in result), JSON.stringify(result));
  assert.equal(overlaySourceFor(PRODUCER)?.text, recovered.winner!.source);
  retractRecovered();
});

/* ---- the revision is what invalidates a cache ------------------------------- */

projectTest("publishing moves the revision and retracting moves it back", () => {
  retractRecovered();
  const empty = overlayRevision();
  const recovered = withContextMode("cold", () => reconstructFunction({ functionName: PRODUCER, notify: () => {} }));
  publishRecovered(PRODUCER, recovered.winner!.source, "reconstruction");
  const published = overlayRevision();
  assert.notEqual(published, empty, "a consumer keyed on this must see the publication");
  assert.equal(retractRecovered(PRODUCER), empty, "and see the retraction too");
});

projectTest("a warm-derived entry is withheld from a cold reader", () => {
  /* Otherwise the overlay becomes a hole in cold mode: an entry recovered with
   * the project's headers and donors would re-enter a run that is measuring
   * what can be done without them. */
  retractRecovered();
  const warm = reconstructFunction({ functionName: PRODUCER, notify: () => {} });
  assert.equal(warm.state, "exact-candidate");
  publishRecovered(PRODUCER, warm.winner!.source, "reconstruction");
  assert.equal(loadOverlay().entries[0]!.contextMode, "warm");
  assert.equal(visibleEntries().length, 1, "a warm reader sees it");
  assert.equal(withContextMode("cold", () => visibleEntries()).length, 0, "a cold reader does not");
  assert.equal(withContextMode("cold", () => overlaySourceFor(PRODUCER)), null);
  retractRecovered();
});

/* ---- the loop closes -------------------------------------------------------- */

projectTest("a published recovery gives its family a donor it did not have", () => {
  retractRecovered();
  withContextMode("cold", () => {
    assert.deepEqual(donorsFor(buildFamilyIndex({ tier: "flexible" }), DEPENDENT).map((d) => d.functionName), []);
    const recovered = reconstructFunction({ functionName: PRODUCER, notify: () => {} });
    publishRecovered(PRODUCER, recovered.winner!.source, "reconstruction");
    const after = donorsFor(buildFamilyIndex({ tier: "flexible" }), DEPENDENT).map((d) => d.functionName);
    assert.ok(after.includes(PRODUCER), `expected ${PRODUCER} among [${after.join(", ")}] — the index is keyed on the revision`);
  });
  retractRecovered();
});

projectTest("the whole feedback experiment closes, with its control", () => {
  const result = runFeedbackExperiment(PRODUCER, DEPENDENT, "cold");
  for (const step of result.steps) assert.ok(step.held, `${step.step}: ${step.detail}`);
  assert.ok(result.demonstrated);
  assert.deepEqual(result.donorsBefore, []);
  assert.deepEqual(result.donorsAfter, [PRODUCER]);
  assert.match(result.producerSignatureBefore, /\[abi\]/, "before publication the callee is an ABI floor");
  assert.match(result.producerSignatureAfter, /\[recovered\]/, "after it, a declaration");
});

projectTest("the experiment leaves the overlay as it found it", () => {
  retractRecovered();
  const before = overlayRevision();
  runFeedbackExperiment(PRODUCER, DEPENDENT, "cold");
  assert.equal(overlayRevision(), before, "a measurement that changes its own subject cannot be repeated");
});
