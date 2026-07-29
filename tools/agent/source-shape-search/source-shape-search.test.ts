import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROOT } from "../decompToolchain.js";
import { generateVariantBatch, totalProducts } from "./generator.js";
import { validateSourceShapeSpec } from "./schema.js";
import { sha256 } from "../variant-lab/artifacts.js";

function spec() {
  return validateSourceShapeSpec({
    schemaVersion: 1,
    function: "func_test",
    baseSourcePath: "build/base.c",
    maxVariants: 10,
    dimensions: [
      {
        id: "first",
        mechanism: "statement-birth-order",
        expectedPass: "sched",
        invariants: ["x remains one or two as explicitly supplied"],
        alternatives: [
          { id: "base", useBase: true, expectedEffect: "baseline birth", invariants: [] },
          { id: "two", edits: [{ find: "x = 1;", replace: "x = 2;" }], expectedEffect: "alternate birth", invariants: [] },
        ],
      },
      {
        id: "second",
        mechanism: "fresh-vs-reused-web",
        expectedPass: "rtl",
        invariants: ["return expression is supplied explicitly"],
        alternatives: [
          { id: "base", useBase: true, expectedEffect: "direct return", invariants: [] },
          { id: "plus", edits: [{ find: "return x;", replace: "return x + 1;" }], expectedEffect: "fresh result", invariants: [] },
        ],
      },
    ],
    constraints: {
      preserveTargetRanges: [[0, 1]],
      preserveOpcodeStream: true,
      forbidInstructionCountGrowth: true,
      preserveExistingEmptyMemoryBarriers: false,
      incompatibleAlternatives: [{ choices: ["first:two", "second:plus"] }],
      requiredAlternatives: [],
    },
  }, "func_test");
}

test("validates concrete finite alternatives and rejects empty actions", () => {
  const migrated = spec();
  assert.equal(totalProducts(migrated), 4);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.scheduleComparison.enabled, false);
  const invalid: any = spec();
  invalid.dimensions[0].alternatives[0] = { id: "empty", expectedEffect: "none", invariants: [] };
  assert.throws(() => validateSourceShapeSpec(invalid), /concrete generation action/);
  assert.throws(() => validateSourceShapeSpec({ ...spec(), compilerFlags: ["-fno-schedule-insns"] }), /unsupported field/);
  assert.throws(() => validateSourceShapeSpec({
    ...spec(),
    traceAllPreprocessed: false,
    scheduleComparison: { enabled: true, analyze: "traced-classes", maxInterventions: 3 },
  }), /requires traceAllPreprocessed/);
  const profiled = validateSourceShapeSpec({
    ...spec(),
    traceAllPreprocessed: true,
    scheduleComparison: { enabled: true, analyze: "traced-classes", maxInterventions: 8 },
  });
  assert.equal(profiled.scheduleComparison.enabled, true);
  assert.equal(profiled.scheduleComparison.maxInterventions, 8);
});

test("generates deterministic Cartesian suffixes, exclusions, and resume batches without touching the base", () => {
  const directory = mkdtempSync(join(ROOT, "build/source-shape-generation-test-"));
  try {
    const base = "int func_test(void)\n{\n    int x;\n    x = 1;\n    return x;\n}\n";
    const basePath = join(directory, "base.c");
    writeFileSync(basePath, base);
    const first = generateVariantBatch({
      spec: spec(),
      baseSource: base,
      baseHash: sha256(base),
      outputRoot: directory,
      startProductIndex: 0,
      budget: 2,
    });
    assert.deepEqual(first.variants.map((variant) => variant.productIndex), [0, 1]);
    const second = generateVariantBatch({
      spec: spec(),
      baseSource: base,
      baseHash: sha256(base),
      outputRoot: directory,
      startProductIndex: first.nextProductIndex,
      budget: 2,
    });
    assert.deepEqual(second.variants.map((variant) => variant.productIndex), [2]);
    assert.equal(second.nextProductIndex, 4);
    assert.equal(readFileSync(basePath, "utf8"), base);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("preserves inherited empty memory barriers without allowing edits to them", () => {
  const directory = mkdtempSync(join(ROOT, "build/source-shape-barrier-test-"));
  try {
    const base = "void func_test(void)\n{\n    int x;\n    x = 1;\n    __asm__ volatile(\"\" ::: \"memory\");\n}\n";
    const barrierSpec = validateSourceShapeSpec({
      schemaVersion: 1,
      function: "func_test",
      baseSourcePath: "build/base.c",
      maxVariants: 3,
      dimensions: [{
        id: "barrier",
        mechanism: "statement-birth-order",
        expectedPass: "sched",
        invariants: ["the inherited barrier is unchanged"],
        alternatives: [
          { id: "base", useBase: true, expectedEffect: "baseline", invariants: [] },
          { id: "clean", edits: [{ find: "x = 1;", replace: "x = 2;" }], expectedEffect: "ordinary edit", invariants: [] },
          { id: "new-barrier", edits: [{ find: "x = 1;", replace: "x = 1; __asm__ volatile(\"\" ::: \"memory\");" }], expectedEffect: "forbidden addition", invariants: [] },
        ],
      }],
      constraints: { preserveExistingEmptyMemoryBarriers: true },
    });
    const generated = generateVariantBatch({
      spec: barrierSpec,
      baseSource: base,
      baseHash: sha256(base),
      outputRoot: directory,
      startProductIndex: 0,
      budget: 3,
    });
    assert.equal(generated.variants[0]?.policyPassed, true);
    assert.equal(generated.variants[1]?.policyPassed, true);
    assert.equal(generated.variants[2]?.policyPassed, false);
    assert.match(generated.variants[2]?.policyError || "", /protected empty memory barrier/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects C99/asm generated source before compilation and retains lineage", () => {
  const directory = mkdtempSync(join(ROOT, "build/source-shape-policy-test-"));
  try {
    const base = "void func_test(void)\n{\n    int x;\n    x = 1;\n}\n";
    const policySpec = validateSourceShapeSpec({
      schemaVersion: 1,
      function: "func_test",
      baseSourcePath: "build/base.c",
      maxVariants: 2,
      dimensions: [{
        id: "policy",
        mechanism: "custom",
        expectedPass: "rtl",
        invariants: ["diagnostic fixture"],
        alternatives: [
          { id: "base", useBase: true, expectedEffect: "clean", invariants: [] },
          { id: "asm", edits: [{ find: "x = 1;", replace: "__asm__(\"nop\");" }], expectedEffect: "forbidden", invariants: [] },
        ],
      }],
      constraints: {},
    });
    const generated = generateVariantBatch({
      spec: policySpec,
      baseSource: base,
      baseHash: sha256(base),
      outputRoot: directory,
      startProductIndex: 0,
      budget: 2,
    });
    assert.equal(generated.variants[0]?.policyPassed, true);
    assert.equal(generated.variants[1]?.policyPassed, false);
    assert.match(generated.variants[1]?.policyError || "", /embedded assembly/);
    assert.equal(generated.variants[1]?.lineage.choices[0]?.alternative, "asm");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
