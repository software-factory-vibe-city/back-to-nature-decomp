import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_CONFIG } from "./config.ts";
import { checkSourcePolicy, isPendingStub } from "./source-policy.ts";

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

test("catches embedded asm written with the reserved __volatile__ spelling", () => {
  const { root, config } = fixture(`void target(void) {\n    __asm__ __volatile__(\"nop\");\n}\n`);
  const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", scanFunctions: ["target"] });
  assert.equal(result.pass, false);
  assert(result.hardFailures.some((finding) => finding.kind === "embedded-asm"));
});

test("a patch-added line is judged against its own file's allowlist entry", () => {
  const { root, config } = fixture("void target(void) {\n    __asm__(\"nop\");\n}\n");
  config.sourcePolicy.allowlist["target"] = ["embedded-asm"];
  const patch = [
    "--- a/src/target.c",
    "+++ b/src/target.c",
    "@@ -1,0 +2,1 @@",
    '+    __asm__("nop");',
  ].join("\n");
  /* Repo-wide sweep: no top-level functionName, so the allowlist can only be
   * reached by attributing the line to src/target.c. */
  const allowlisted = checkSourcePolicy({ projectRoot: root, config, scanFunctions: ["target"], patch });
  assert.equal(allowlisted.pass, true);

  delete config.sourcePolicy.allowlist["target"];
  const bare = checkSourcePolicy({ projectRoot: root, config, scanFunctions: ["target"], patch });
  assert(bare.hardFailures.some((finding) => finding.kind === "embedded-asm"));
});

test("a note quoting embedded asm is documentation, not a violation", () => {
  const { root, config } = fixture("void target(void) {}\n");
  const patch = [
    "--- a/notes/retros/example.md",
    "+++ b/notes/retros/example.md",
    "@@ -1,0 +2,1 @@",
    '+    __asm__ __volatile__("nop");',
  ].join("\n");
  const result = checkSourcePolicy({ projectRoot: root, config, scanFunctions: ["target"], patch });
  assert.equal(result.pass, true);
});

test("classifies a pin written without underscores as register pinning, not embedded asm", () => {
  const { root, config } = fixture(`void target(void) {\n    register int x asm(\"v0\");\n}\n`);
  const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", scanFunctions: ["target"] });
  assert.equal(result.pass, false);
  assert(result.hardFailures.some((finding) => finding.kind === "register-asm"));
});

test("an undecompiled backlog stub is a pending stub; a partial fold is not", () => {
  assert.equal(isPendingStub(`#include "common.h"\n#include "include_asm.h"\n\nINCLUDE_ASM("build/asm/x", target);\n`), true);
  assert.equal(isPendingStub(`/* INCLUDE_ASM is only mentioned here */\n#include "common.h"\n\nINCLUDE_ASM("build/asm/x", target);\n`), true);
  assert.equal(isPendingStub(`#include "common.h"\n\nint helper(void) { return 1; }\nINCLUDE_ASM("build/asm/x", target);\n`), false);
  assert.equal(isPendingStub(`void target(void) {}\n`), false);
});

test("an asm label on a declaration is a symbol rename, not embedded assembly", () => {
  const { root, config } = fixture("void target(void) {}\n");
  const added = (line: string) => [
    "--- a/include/globals_override.h",
    "+++ b/include/globals_override.h",
    "@@ -1,0 +2,1 @@",
    `+${line}`,
  ].join("\n");

  /* The documented override for an absolutely-addressed generated symbol. */
  for (const line of [
    'extern struct_80070000 _D_80070000[1] __asm__("D_80070000");',
    'extern s32 _D_8004B1A4[3] __asm__("D_8004B1A4");',
  ]) {
    const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", patch: added(line) });
    assert.equal(result.pass, true, `expected an asm label to pass: ${line}`);
  }

  /* Instructions must not enter through it, however the line is arranged. */
  for (const line of [
    '__asm__("nop");',
    'int x = 0; __asm__("nop");',
    'void f(void) { __asm__("nop"); }',
    'extern int x __asm__("lw %0, 0(%1)" : "=r"(a));',
  ]) {
    const result = checkSourcePolicy({ projectRoot: root, config, functionName: "target", patch: added(line) });
    assert.equal(result.pass, false, `expected an asm statement to fail: ${line}`);
  }
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

test("an overlay's translation unit is scanned where it actually lives", () => {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-policy-overlay-"));
  mkdirSync(join(root, "src", "overlays", "ovl_31"), { recursive: true });
  mkdirSync(join(root, "configs"), { recursive: true });
  writeFileSync(join(root, "configs", "flag_overrides.mk"), "");
  writeFileSync(
    join(root, "src", "overlays", "ovl_31", "ovl_31_target.c"),
    `void ovl_31_target(void) {\n    __asm__(\"nop\");\n}\n`,
  );
  const config = structuredClone(DEFAULT_CONFIG);
  config.runtimeDir = join(root, "run_output");

  /* Without the source map the scan looks under `src/`, finds nothing, and
     reports a clean function it never opened — a pass, not an error. */
  const blind = checkSourcePolicy({ projectRoot: root, config, functionName: "ovl_31_target", scanFunctions: ["ovl_31_target"] });
  assert.equal(blind.pass, true);

  const placed = checkSourcePolicy({
    projectRoot: root,
    config,
    functionName: "ovl_31_target",
    functionContainer: "ovl_31",
    functionSources: { ovl_31_target: "src/overlays/ovl_31/ovl_31_target.c" },
    scanFunctions: ["ovl_31_target"],
  });
  assert.equal(placed.pass, false);
  assert(placed.hardFailures.some((finding) => finding.kind === "embedded-asm"));
});

test("a patch to an overlay source is attributed to the function, not to the path tail", () => {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-policy-patch-"));
  mkdirSync(join(root, "configs"), { recursive: true });
  const config = structuredClone(DEFAULT_CONFIG);
  config.runtimeDir = join(root, "run_output");
  config.sourcePolicy.allowlist = { ovl_31_target: ["embedded-asm"] };

  const patch = [
    "+++ b/src/overlays/ovl_31/ovl_31_target.c",
    "@@ -1,0 +2,1 @@",
    '+    __asm__("nop");',
  ].join("\n");

  /* The allowlist is keyed by the function's name. Reading the path tail as the
     name yields `overlays/ovl_31/ovl_31_target`, which matches no entry. */
  const result = checkSourcePolicy({ projectRoot: root, config, changedFiles: [], patch });
  assert.equal(result.newlyAddedForbiddenConstructs.length, 0);
});

test("a bare-address allowlist key is the executable's, never another container's", () => {
  const root = mkdtempSync(join(tmpdir(), "autodecomp-policy-keys-"));
  mkdirSync(join(root, "src", "overlays", "ovl_30"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "configs"), { recursive: true });
  writeFileSync(join(root, "configs", "flag_overrides.mk"), "");
  const body = `void f(void) {\n    __asm__(\"nop\");\n}\n`;
  writeFileSync(join(root, "src", "exe_fn.c"), body);
  writeFileSync(join(root, "src", "overlays", "ovl_30", "ovl_30_fn.c"), body);

  const config = structuredClone(DEFAULT_CONFIG);
  config.runtimeDir = join(root, "run_output");
  config.sourcePolicy.allowlist = { "0x800b7e24": ["embedded-asm"] };

  const scan = (name: string, container: string, source: string) => checkSourcePolicy({
    projectRoot: root,
    config,
    functionName: name,
    functionVram: "0x800B7E24",
    functionContainer: container,
    functionSources: { [name]: source },
    scanFunctions: [name],
  });

  /* Same address, same exception key, two different functions. Granting it to
     both is how one function's policy exception licenses another's assembly. */
  assert.equal(scan("exe_fn", "exe", "src/exe_fn.c").pass, true);
  assert.equal(scan("ovl_30_fn", "ovl_30", "src/overlays/ovl_30/ovl_30_fn.c").pass, false);

  config.sourcePolicy.allowlist = { "ovl_30:0x800b7e24": ["embedded-asm"] };
  assert.equal(scan("ovl_30_fn", "ovl_30", "src/overlays/ovl_30/ovl_30_fn.c").pass, true);
  assert.equal(scan("exe_fn", "exe", "src/exe_fn.c").pass, false);
});
