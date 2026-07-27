import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { ROOT } from "../decompToolchain.js";
import { deterministicRunId, hashDirectoryFiles, preserveSource, stableJson, writeStableJson } from "./artifacts.js";
import { classifyHypothesis } from "./classify-hypothesis.js";
import { validateManifest, validateVariantSource } from "./manifest.js";
import { comparePassSnapshots, snapshotPassContent } from "./pass-diff.js";
import { generateTransformationVariants } from "./transformations.js";
import { PASS_STAGES, type PassSnapshot, type PassStage, type ToolIdentity, type VariantHypothesis } from "./types.js";

function insn(uid: number, destination: number, source: string, deaths = ""): string {
  return `(insn ${uid} 0 0 (set (reg:SI ${destination}) ${source}) -1 (nil)${deaths ? ` (expr_list (REG_DEAD (reg:SI ${deaths})) (nil))` : " (nil)"})`;
}

function dump(lines: string[], assignments: Array<[number, number]> = []): string {
  return `${lines.join("\n")}\n${assignments.map(([pseudo, hard]) => `;; Register ${pseudo} in ${hard}.`).join("\n")}\n`;
}

function snapshots(changes: Partial<Record<PassStage, string>> = {}): Map<PassStage, PassSnapshot> {
  const base = dump([
    insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
    insn(20, 117, "(ior:SI (reg:SI 92) (reg:SI 93))"),
  ], [[105, 2], [117, 3]]);
  return new Map(PASS_STAGES.map((stage) => [stage, snapshotPassContent(stage, changes[stage] || base)]));
}

const hypothesis: VariantHypothesis = {
  id: "tag-reuse",
  sourcePath: "build/tag-reuse.c",
  mechanism: "single-vs-multi-set",
  expectedPass: "rtl",
  expectedEffect: "reuse the x-sum pseudo for the later tag OR",
  invariants: ["stores remain identical"],
};

const toolchain: ToolIdentity = {
  node: "v24",
  variantLab: { schemaVersion: 1, sha256: "lab" },
  compiler: { path: "cc1", sha256: "a", version: "gcc" },
  assemblerShim: { path: "maspsx", sha256: "b" },
  cpp: "cpp",
  assembler: "as",
  objdump: "objdump",
};

test("validates manifests and rejects missing mechanism metadata", () => {
  assert.equal(validateManifest({ variants: [hypothesis] }).variants[0].mechanism, "single-vs-multi-set");
  assert.throws(() => validateManifest({ variants: [{ ...hypothesis, mechanism: "" }] }), /mechanism must be a non-empty string/);
  assert.throws(() => validateManifest({ variants: [{ ...hypothesis, expectedEffect: "" }] }), /expectedEffect/);
  assert.throws(() => validateManifest({ variants: [hypothesis, { ...hypothesis }] }), /duplicate variant id/);
});

test("deterministic run IDs and manifests do not depend on object key order", () => {
  const variant = {
    ...hypothesis,
    absoluteSourcePath: "/tmp/tag-reuse.c",
    sourceHash: "source-hash",
  };
  const options = {
    functionName: "func_test",
    mode: "full" as const,
    tracePasses: true,
    variants: [variant],
    toolchain,
    compilerFlags: ["-O2"],
  };
  assert.equal(deterministicRunId(options), deterministicRunId({ ...options }));
  assert.equal(stableJson({ z: 1, a: 2 }), stableJson({ a: 2, z: 1 }));
});

test("preserves exact source artifacts and records deterministic hashes", () => {
  const directory = mkdtempSync(join(ROOT, "build/variant-artifact-test-"));
  try {
    const original = join(directory, "original.c");
    const preserved = join(directory, "variant", "source.c");
    writeFileSync(original, "void f(void)\n{\n}\n");
    preserveSource(original, preserved);
    assert.equal(readFileSync(preserved, "utf8"), readFileSync(original, "utf8"));
    const hashes = hashDirectoryFiles(join(directory, "variant"));
    assert.match(hashes["source.c"], /^[0-9a-f]{64}$/);
    writeStableJson(join(directory, "one.json"), { z: 1, a: 2 });
    writeStableJson(join(directory, "two.json"), { a: 2, z: 1 });
    assert.equal(readFileSync(join(directory, "one.json"), "utf8"), readFileSync(join(directory, "two.json"), "utf8"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reports first divergence in rtl, combine, sched, and lreg fixtures", () => {
  for (const stage of ["rtl", "combine", "sched"] as PassStage[]) {
    const changed = dump([
      insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
      insn(21, 105, "(ior:SI (reg:SI 92) (reg:SI 93))"),
    ], [[105, 3]]);
    const comparison = comparePassSnapshots(snapshots(), snapshots({ [stage]: changed }));
    assert.equal(comparison.firstDivergence?.stage, stage);
    assert.match(comparison.firstDivergence?.summary || "", /pseudo 105 set count changed 1 -> 2/);
  }
  const allocation = dump([
    insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
    insn(20, 117, "(ior:SI (reg:SI 92) (reg:SI 93))"),
  ], [[105, 3], [117, 2]]);
  const comparison = comparePassSnapshots(snapshots(), snapshots({ lreg: allocation }));
  assert.equal(comparison.firstDivergence?.stage, "lreg");
  assert.match(comparison.firstDivergence?.summary || "", /assignment changed/);
});

test("classifies no-effect variants as equivalent and rejected", () => {
  const comparison = comparePassSnapshots(snapshots(), snapshots());
  assert.equal(comparison.equivalent, true);
  const classification = classifyHypothesis({
    hypothesis,
    status: "mismatch",
    passComparison: comparison,
    tracePasses: true,
    cc1Only: false,
    baseline: false,
  });
  assert.equal(classification.verdict, "rejected");
  assert.match(classification.reason, /equivalent to the baseline/);
});

test("rejects forbidden and non-C89 variant constructs before compilation", () => {
  assert.match(validateVariantSource("void f(void) { __asm__(\"nop\"); }\n")[0].message, /embedded assembly/);
  assert.match(validateVariantSource("void f(void) { for (int i = 0; i < 1; i++) {} }\n")[0].message, /C99/);
  assert.match(validateVariantSource("int D_80001234;\n")[0].message, /generated globals/);
  assert.equal(validateVariantSource("void f(void)\n{\n    int i;\n    i = 0;\n}\n").length, 0);
});

test("curated transformation templates emit complete policy-clean C89 files under build", () => {
  const directory = mkdtempSync(join(ROOT, "build/variant-template-test-"));
  try {
    const base = join(directory, "base.c");
    const spec = join(directory, "spec.json");
    const output = join(directory, "generated");
    writeFileSync(base, "void func_test(void)\n{\n    int fresh;\n    int reused;\n    fresh = 1;\n    reused = fresh;\n}\n");
    writeFileSync(spec, JSON.stringify({
      function: "func_test",
      template: "fresh-local-vs-reuse",
      baseSourcePath: relative(ROOT, base),
      outputDirectory: relative(ROOT, output),
      expectedPass: "rtl",
      outputs: [{
        id: "reuse",
        expectedEffect: "remove the fresh web",
        invariants: ["result remains one"],
        edits: [
          { find: "    int fresh;\n", replace: "" },
          { find: "    fresh = 1;\n    reused = fresh;", replace: "    reused = 1;" },
        ],
      }],
    }));
    const generated = generateTransformationVariants(relative(ROOT, spec), "func_test");
    assert.equal(generated[0].mechanism, "fresh-vs-reused-web");
    const source = readFileSync(join(output, "reuse.c"), "utf8");
    assert.equal(validateVariantSource(source).length, 0);
    assert.match(source, /^void func_test\(void\)/);
    assert.doesNotMatch(source, /fresh/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cc1-only exact variants cannot be promoted", () => {
  const cc1 = classifyHypothesis({
    hypothesis,
    status: "exact",
    passComparison: comparePassSnapshots(snapshots(), snapshots({ rtl: dump([
      insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
      insn(21, 105, "(ior:SI (reg:SI 92) (reg:SI 93))"),
    ]) })),
    tracePasses: true,
    cc1Only: true,
    baseline: false,
  });
  assert.equal(cc1.verdict, "confirmed");
  assert.equal(cc1.promotionEligible, false);
  const full = classifyHypothesis({
    hypothesis,
    status: "exact",
    passComparison: cc1.verdict === "confirmed" ? comparePassSnapshots(snapshots(), snapshots({ rtl: dump([
      insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
      insn(21, 105, "(ior:SI (reg:SI 92) (reg:SI 93))"),
    ]) })) : undefined,
    tracePasses: true,
    cc1Only: false,
    baseline: false,
  });
  assert.equal(full.promotionEligible, true);
});

test("func_800154CC regression explains tag-result web reuse and branch-join mask scheduling", () => {
  const tagReuse = comparePassSnapshots(snapshots(), snapshots({ rtl: dump([
    insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
    insn(21, 105, "(ior:SI (reg:SI 92) (reg:SI 93))"),
  ]) }));
  assert.equal(tagReuse.firstDivergence?.stage, "rtl");
  assert.match(tagReuse.firstDivergence?.summary || "", /set count changed 1 -> 2/);

  const scheduled = dump([
    insn(20, 117, "(ior:SI (reg:SI 92) (reg:SI 93))"),
    insn(10, 105, "(plus:SI (reg:SI 90) (reg:SI 91))"),
  ], [[105, 2], [117, 3]]);
  const maskPlacement = comparePassSnapshots(snapshots(), snapshots({ sched: scheduled }));
  assert.equal(maskPlacement.firstDivergence?.stage, "sched");
  assert.match(maskPlacement.firstDivergence?.summary || "", /instruction 0 changed/);
});
