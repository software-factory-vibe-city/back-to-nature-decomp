/**
 * Phase A1 of plans/automatic-matching-reconstruction.md: the candidate-object
 * cache must be derived from *every* input that decides the compile — the
 * measured failure was a per-function flag override whose removal reused a
 * stale object. These tests reproduce the staleness holes at the fingerprint
 * level: an input class missing from `candidateObjectInputs` cannot change the
 * fingerprint, and each test would fail against the pre-repair inputs.
 */

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { sourceDependencyFiles } from "../decompToolchain.js";
import { computeProvenance } from "../provenance.js";
import { candidateObjectInputs } from "./reverse.js";

const hasCpp = (() => {
  try {
    execFileSync("mips-linux-gnu-cpp", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function fixtureSource(): { directory: string; source: string; header: string } {
  const directory = mkdtempSync(join(tmpdir(), "psx-a1-"));
  const header = join(directory, "fixture_header.h");
  const source = join(directory, "provenance_fixture_fn.c");
  writeFileSync(header, "#define FIXTURE_BOUND 5\n");
  writeFileSync(source, `#include "fixture_header.h"\nint provenance_fixture_fn(void) { return FIXTURE_BOUND; }\n`);
  return { directory, source, header };
}

test("transitive headers are cache inputs", { skip: !hasCpp }, () => {
  const { directory, source, header } = fixtureSource();
  try {
    const dependencies = sourceDependencyFiles(source);
    assert.ok(dependencies.includes(source));
    assert.ok(dependencies.some((file) => file.endsWith("fixture_header.h")), `deps: ${dependencies.join(", ")}`);

    const before = computeProvenance("provenance_fixture_fn", candidateObjectInputs("provenance_fixture_fn", source));
    writeFileSync(header, "#define FIXTURE_BOUND 6\n");
    const changed = computeProvenance("provenance_fixture_fn", candidateObjectInputs("provenance_fixture_fn", source));
    assert.notEqual(before.fingerprint, changed.fingerprint, "editing an included header must invalidate the cache");

    writeFileSync(header, "#define FIXTURE_BOUND 5\n");
    const restored = computeProvenance("provenance_fixture_fn", candidateObjectInputs("provenance_fixture_fn", source));
    assert.equal(before.fingerprint, restored.fingerprint, "restoring the header must restore the fingerprint");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the flag-override table and the Makefile are cache inputs", { skip: !hasCpp }, () => {
  const { directory, source } = fixtureSource();
  try {
    const inputs = candidateObjectInputs("provenance_fixture_fn", source);
    const files = (inputs.files ?? []).map((file) => file.replace(/\\/g, "/"));
    assert.ok(files.some((file) => file.endsWith("configs/flag_overrides.mk")),
      "the override table decides per-function flags; its absence was the measured stale-cache failure");
    assert.ok(files.some((file) => file.endsWith("Makefile")),
      "the Makefile owns every flag set the compile resolves");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("effective flag sets are cache inputs, container kind included", { skip: !hasCpp }, () => {
  const { directory, source } = fixtureSource();
  try {
    const exeInputs = candidateObjectInputs("provenance_fixture_fn", source);
    assert.ok(exeInputs.values && "cc1Flags" in exeInputs.values && "cppFlags" in exeInputs.values
      && "asFlags" in exeInputs.values && "maspsxFlags" in exeInputs.values,
      "the effective preprocessing/compiler/assembler arguments must be part of the key");

    /* An overlay symbol resolves the overlay flag set; the two keys differ
     * exactly in the container-derived values. */
    const overlayInputs = candidateObjectInputs("ovl_11_provenance_fixture_fn", source);
    const exeStamp = computeProvenance("fn", { values: exeInputs.values });
    const overlayStamp = computeProvenance("fn", { values: overlayInputs.values });
    assert.notEqual(exeStamp.fingerprint, overlayStamp.fingerprint);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("symbol tables are deliberately not object-cache inputs", { skip: !hasCpp }, () => {
  /* Symbol and layout changes must invalidate *comparisons*, which run fresh
   * on every reversePipeline call; the object itself does not read them, so
   * keying the object on them would only cause pointless recompiles. */
  const { directory, source } = fixtureSource();
  try {
    const inputs = candidateObjectInputs("provenance_fixture_fn", source);
    for (const file of inputs.files ?? []) {
      assert.ok(!/symbol|splat|undefined_(funcs|syms)/.test(file), `unexpected symbol-table input: ${file}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
