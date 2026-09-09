import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, configuredCompilerPath } from "../decompToolchain.js";
import { loadContainer, containerTargetPath } from "../../lib/container.js";
import { reconstructFunction } from "./engine.js";

/* The end-to-end slice needs the configured compiler and the overlay's
 * extracted image; without them this is a different machine's problem. */
function overlayReady(): boolean {
  if (!existsSync(configuredCompilerPath())) return false;
  const container = (() => {
    try { return loadContainer("ovl_11"); } catch { return null; }
  })();
  return container !== null && existsSync(containerTargetPath(container));
}

const ready = overlayReady();

test("the embedded-table regression reconstructs from source-hidden inputs", { skip: !ready }, () => {
  const result = reconstructFunction({
    functionName: "ovl_11_func_800F13D8",
    outputDirectory: join(ROOT, "build/matchingReconstruction/test-regression"),
    notify: () => {},
  });

  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.ok(result.winner);
  assert.equal(result.winner!.matchedWords, result.winner!.totalWords);

  /* The relation's constants come from the bytes, not from any source. */
  assert.equal(result.relation!.base, 0x800742b0);
  assert.equal(result.relation!.stride, 12);
  assert.equal(result.relation!.count, 5);

  /* The winning origin is the parent view, witnessed by other functions'
   * machine accesses — the exact alternative the standalone-label assumption
   * had excluded (plan §2). */
  assert.equal(result.winner!.choice.origin.kind, "embedded");
  const origin = result.winner!.choice.origin;
  assert.ok(origin.kind === "embedded" && origin.offset === 0x7a78);

  /* Source-hidden contract: the generator read target-side artifacts only —
   * no live sources, no project type headers — and the winner compiled in the
   * standalone context, so no header reached it at compile time either. */
  for (const input of result.inputsRead) {
    assert.ok(!input.startsWith("src/"), `generator read a live source: ${input}`);
    assert.ok(!input.startsWith("include/"), `generator read a project header: ${input}`);
  }
  assert.equal(result.winner!.choice.context, "standalone");
  assert.ok(!result.winner!.source.includes("D8006C838RecordTableView"));
});

test("a scan starting past the table's first record reconstructs through the same view", { skip: !ready }, () => {
  /* ovl_11_func_800DBF60 visits records [1, 5) of the table other functions
   * witness at D_8006C838 + 0x7A78; the window offset must come from the
   * label/witness evidence, not from the scan's own first load. */
  const result = reconstructFunction({
    functionName: "ovl_11_func_800DBF60",
    outputDirectory: join(ROOT, "build/matchingReconstruction/test-offset-start"),
    notify: () => {},
  });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.equal(result.winner!.choice.origin.startIndex, 1);
  assert.match(result.winner!.source, /for \(i = 1; i < 5; i\+\+\)/);
});

test("a straight-line store function reconstructs through the effect class", { skip: !ready }, () => {
  /* func_8001BF74 writes three gp-relative globals and returns nothing; the
   * tentative definitions are what reproduce the small-data addressing. */
  const result = reconstructFunction({
    functionName: "func_8001BF74",
    outputDirectory: join(ROOT, "build/matchingReconstruction/test-effects"),
    notify: () => {},
  });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.equal(result.winner!.matchedWords, result.winner!.totalWords);
  assert.ok(result.effectRelation);
});

test("a guarded decision tree reconstructs through the guarded class", { skip: !ready }, () => {
  const result = reconstructFunction({
    functionName: "ovl_23_func_800BA278",
    outputDirectory: join(ROOT, "build/matchingReconstruction/test-guarded"),
    notify: () => {},
  });
  assert.equal(result.state, "exact-candidate", result.unresolved?.detail);
  assert.equal(result.winner!.matchedWords, result.winner!.totalWords);
  assert.match(result.winner!.source, /if \(/);
});

test("reconstruction is deterministic across invocations", { skip: !ready }, () => {
  const options = {
    functionName: "ovl_11_func_800F13D8",
    outputDirectory: join(ROOT, "build/matchingReconstruction/test-determinism"),
    notify: () => {},
  };
  const first = reconstructFunction(options);
  const second = reconstructFunction(options);
  assert.equal(first.state, "exact-candidate");
  assert.equal(second.state, "exact-candidate");
  assert.equal(first.winner!.id, second.winner!.id);
  assert.equal(first.winner!.source, second.winner!.source);
});
