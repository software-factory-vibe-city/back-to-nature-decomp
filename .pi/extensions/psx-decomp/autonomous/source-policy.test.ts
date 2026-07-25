import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_CONFIG } from "./config.ts";
import { checkSourcePolicy } from "./source-policy.ts";

function fixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-policy-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "configs"));
  writeFileSync(join(root, "src", "target.c"), source);
  writeFileSync(join(root, "configs", "flag_overrides.mk"), "");
  const config = structuredClone(DEFAULT_CONFIG);
  config.runtimeDir = join(root, "run_output");
  return { root, config };
}

test("allows comments and the narrow empty memory scheduling barrier", () => {
  const { root, config } = fixture(`/* __asm__(\"not code\") */\nvoid target(void) {\n    __asm__ volatile(\"\" ::: \"memory\");\n}\n`);
  const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", scanFunctions: ["target"] });
  assert.equal(result.pass, true);
});

test("rejects register pinning, embedded assembly, and stubs", () => {
  const { root, config } = fixture(`void target(void) {\n    register int x __asm__(\"v0\");\n    __asm__(\"nop\");\n    INCLUDE_ASM(\"x\", target);\n}\n`);
  const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", scanFunctions: ["target"] });
  assert.equal(result.pass, false);
  assert.deepEqual(new Set(result.hardFailures.map((finding) => finding.kind)), new Set(["register-asm", "embedded-asm", "include-asm"]));
});

test("rejects out-of-scope files and added flag overrides", () => {
  const { root, config } = fixture("void target(void) {}\n");
  const patch = `diff --git a/configs/flag_overrides.mk b/configs/flag_overrides.mk\n--- a/configs/flag_overrides.mk\n+++ b/configs/flag_overrides.mk\n@@ -0,0 +1 @@\n+CC1FLAGS_target := -fno-schedule-insns\n`;
  const result = checkSourcePolicy({
    projectRoot: root,
    config,
    functionName: "target",
    changedFiles: ["README.md", "configs/flag_overrides.mk"],
    patch,
  });
  assert.equal(result.pass, false);
  assert(result.hardFailures.some((finding) => finding.kind === "out-of-scope"));
  assert(result.hardFailures.some((finding) => finding.kind === "flag-override"));
});
