/**
 * Cold context: what the reconstruction can do without previously recovered C.
 *
 * The thing this guards against is a measurement that flatters itself. Almost
 * every number about automatic reconstruction in this tree is warm — produced
 * where hundreds of functions are already matched, their headers generated and
 * their C available as donors — and warm numbers do not generalise, because a
 * project on its first day has none of that.
 *
 * So the tests hold two things. Cold mode must actually withhold the recovered
 * material: a matched callee's signature, the umbrella compile context, and
 * every family donor. And it must withhold *only* that: the compiler, the
 * flags, the SDK headers and the target artifacts are the same in both, or the
 * comparison is measuring project setup rather than reconstruction.
 */

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT } from "../decompToolchain.js";
import { contextMode, describeContextMode, setContextMode, warmContextAllowed, withContextMode } from "./context-mode.js";
import { resolveSignature } from "./callee-signature.js";
import { reconstructFunction } from "./engine.js";
import { buildFamilyIndex, donorsFor } from "../family-transfer/family-index.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";

const configured = existsSync(join(ROOT, "configs/splat"));
const projectTest = configured ? test : test.skip;

test("the mode is restored even when the body throws", () => {
  assert.equal(contextMode(), "warm");
  assert.throws(() => withContextMode("cold", () => { throw new Error("probe"); }), /probe/);
  assert.equal(contextMode(), "warm", "a throw inside cold mode must not leave the process cold");
});

test("the mode describes what it withholds, not just its name", () => {
  assert.match(withContextMode("cold", () => describeContextMode()), /withheld/);
  assert.match(describeContextMode(), /available/);
});

test("warm is the default, so nothing measures cold by accident", () => {
  assert.equal(contextMode(), "warm");
  assert.equal(warmContextAllowed(), true);
});

projectTest("a matched callee's signature is withheld in cold mode", () => {
  /* CopyVec3 has a matched definition; warm, that is a `matched` signature.
   * Cold, the tier is gone and the answer must come from the SDK or the
   * callee's own machine code — or be honestly unknown. */
  const container = requireFunctionLocation("func_8001F190").container;
  const warm = resolveSignature("CopyVec3", undefined, container);
  assert.ok(!("unknown" in warm));
  assert.equal((warm as { source: string }).source, "matched");

  const cold = withContextMode("cold", () => resolveSignature("CopyVec3", undefined, container));
  if (!("unknown" in cold)) {
    assert.notEqual((cold as { source: string }).source, "matched", "the matched tier must not answer in cold mode");
  }
});

projectTest("family donors disappear in cold mode, but families do not", () => {
  const warmIndex = buildFamilyIndex({ tier: "flexible" });
  const warmDonors = donorsFor(warmIndex, "ovl_11_func_800D5ABC");
  assert.ok(warmDonors.length > 0, "this function has donors when recovered C is available");

  const coldIndex = withContextMode("cold", () => buildFamilyIndex({ tier: "flexible" }));
  const coldDonors = withContextMode("cold", () => donorsFor(coldIndex, "ovl_11_func_800D5ABC"));
  assert.equal(coldDonors.length, 0, "no donor exists when no recovered C does");

  /* The family itself is a word-shape fact and survives. */
  const family = coldIndex.families.find((candidate) =>
    candidate.members.some((member) => member.functionName === "ovl_11_func_800D5ABC"));
  assert.ok(family, "the family is a target-side fact and does not depend on anyone's C");
  assert.ok(family!.members.length > 1);
});

projectTest("cold mode withholds the umbrella compile context", () => {
  const cold = withContextMode("cold", () =>
    reconstructFunction({ functionName: "func_8001BF74", notify: () => {} }));
  assert.equal(cold.contextMode, "cold", "the result records which question it answered");
  for (const candidate of cold.candidates) {
    assert.ok(!candidate.id.endsWith("-umbrella"), `${candidate.id} used the project's generated headers in a cold run`);
  }
});

projectTest("the domain a cold run reports is the domain it was allowed", () => {
  /* Withholding the umbrella header removes candidates, so the evaluated count
   * must be compared against what survived the filter. Comparing it against the
   * unfiltered total makes a cold run that exhausted everything it was allowed
   * report a candidate-budget stop — turning "nothing here matches" into
   * "raise the budget and try again". */
  const name = "ovl_11_func_800C6E0C";
  const warm = reconstructFunction({ functionName: name, notify: () => {} });
  const umbrella = warm.candidates.filter((candidate) => candidate.id.endsWith("-umbrella")).length;
  assert.ok(umbrella > 0, "this function has umbrella candidates, which is what cold mode withholds");

  const cold = withContextMode("cold", () => reconstructFunction({ functionName: name, notify: () => {} }));
  assert.equal(cold.candidates.length, warm.candidates.length - umbrella);
  assert.notEqual(cold.state, "budget-exhausted", cold.unresolved?.detail);
  assert.equal(cold.state, warm.state, "the same terminal meaning, over a smaller domain");
});

projectTest("a standalone recovery is the same warm and cold", () => {
  /* This one reconstructs from target facts alone, so withholding recovered C
   * must change nothing. A difference here would mean cold mode is withholding
   * something it should not. */
  const warm = reconstructFunction({ functionName: "func_8001BF74", notify: () => {} });
  const cold = withContextMode("cold", () => reconstructFunction({ functionName: "func_8001BF74", notify: () => {} }));
  assert.equal(warm.state, "exact-candidate", warm.unresolved?.detail);
  assert.equal(cold.state, "exact-candidate", cold.unresolved?.detail);
});

test("setContextMode is reversible, so a harness cannot strand the process", () => {
  setContextMode("cold");
  assert.equal(warmContextAllowed(), false);
  setContextMode("warm");
  assert.equal(warmContextAllowed(), true);
});
