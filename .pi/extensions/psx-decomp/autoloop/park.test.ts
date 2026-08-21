import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildApprovalNote, canonicalStub, composeParkedSource, planPark, stripPreviousPark } from "./park.ts";
import { isNotesPath, restoreDrift, snapshotFiles } from "./scope-guard.ts";
import type { ParkRecord } from "./types.ts";

const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");

const base = {
  functionName: "func_80012345",
  reason: "escalation-exhausted" as const,
  reachedTier: "gpt-5.6-sol",
  notePath: "notes/human-needed-approvals/func_80012345.md",
  parkedAt: "2026-08-09T00:00:00.000Z",
};

const STUB = '#include "common.h"\n#include "include_asm.h"\n\nINCLUDE_ASM("build/asm/nonmatchings/func_80012345", func_80012345);\n';
const ATTEMPT = '#include "common.h"\n\nint func_80012345(int a) {\n    return a + 1;\n}\n';

function scratch(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "autoloop-park-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("composing a park puts the stub first and the attempt in a disabled block", () => {
  const parked = composeParkedSource({ ...base, base: STUB, attemptSource: ATTEMPT, preserveAttempt: true });

  assert.match(parked, /INCLUDE_ASM\("build\/asm\/nonmatchings\/func_80012345", func_80012345\);/);
  assert.match(parked, /^#if 0$/m);
  assert.match(parked, /^#endif$/m);
  assert.ok(parked.includes("return a + 1;"));
  assert.ok(parked.indexOf("INCLUDE_ASM") < parked.indexOf("#if 0"));
  assert.match(parked, /PARKED by \/auto_decompilation_loop/);
  assert.ok(parked.includes(base.notePath));
});

test("a park that cannot preserve the attempt says so and emits no empty block", () => {
  const parked = composeParkedSource({ ...base, base: STUB, attemptSource: ATTEMPT, preserveAttempt: false });
  assert.equal(/^#if 0$/m.test(parked), false);
  assert.equal(parked.includes("preserved verbatim below"), false);
  assert.equal(parked.match(/INCLUDE_ASM/g)?.length, 1);
});

test("planning a park preserves a well-formed attempt and proves the result parses", async () => {
  const { dir, cleanup } = scratch();
  try {
    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: ATTEMPT,
      committedSource: STUB,
    });
    assert.equal(plan.preserved, true);
    assert.deepEqual(plan.reasons, []);
    assert.match(plan.source, /^#if 0$/m);
    assert.ok(plan.source.includes("return a + 1;"));
  } finally {
    cleanup();
  }
});

test("planning refuses to embed an attempt whose stray #endif would close the wrapper", async () => {
  const { dir, cleanup } = scratch();
  try {
    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: "#endif\nint func_80012345(void) { return 0; }\n",
      committedSource: STUB,
    });
    assert.equal(plan.preserved, false);
    assert.match(plan.reasons.join("\n"), /not safe to embed/);
    assert.equal(/^#if 0$/m.test(plan.source), false);
    assert.match(plan.source, /INCLUDE_ASM/);
  } finally {
    cleanup();
  }
});

test("planning refuses to embed an attempt that does not parse", async () => {
  const { dir, cleanup } = scratch();
  try {
    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: "int func_80012345(void) { return 0; } /* unterminated\n",
      committedSource: STUB,
    });
    assert.equal(plan.preserved, false);
    assert.match(plan.reasons.join("\n"), /not safe to embed/);
  } finally {
    cleanup();
  }
});

test("re-parking does not nest the stub inside its own disabled block", async () => {
  const { dir, cleanup } = scratch();
  try {
    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: STUB,
      committedSource: STUB,
    });
    assert.equal(plan.preserved, false);
    assert.match(plan.reasons.join("\n"), /itself an INCLUDE_ASM stub/);
    assert.equal(plan.source.match(/INCLUDE_ASM/g)?.length, 1);
  } finally {
    cleanup();
  }
});

test("parking a function whose committed source is already a park does not stack the parks", async () => {
  const { dir, cleanup } = scratch();
  try {
    const first = composeParkedSource({ ...base, base: STUB, attemptSource: ATTEMPT, preserveAttempt: true });
    assert.equal(stripPreviousPark(first), STUB);

    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: "#include \"common.h\"\n\nint func_80012345(int a) {\n    return a + 2;\n}\n",
      committedSource: first,
    });

    assert.equal(plan.reasons.join("\n").includes("synthesized a canonical stub"), false);
    assert.equal(plan.source.match(/PARKED by/g)?.length, 1);
    assert.equal(plan.source.match(/#if 0/g)?.length, 1);
    assert.equal(plan.source.includes("return a + 1;"), false);
    assert.ok(plan.source.includes("return a + 2;"));
  } finally {
    cleanup();
  }
});

test("a synthesized stub names the container's own assembly directory", () => {
  const { dir, cleanup } = scratch();
  try {
    /* The call graph places the function; the stub has to follow it. A stub
       written against `build/asm/nonmatchings/` for an overlay compiles — the
       macro takes a string — and then fails the link on a missing symbol, which
       reads as a broken park rather than a wrong path. */
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(join(dir, "build", "callGraph.json"), JSON.stringify({
      functions: [{
        name: "ovl_31_func_800B82E8",
        container: "ovl_31",
        source: "src/overlays/ovl_31/ovl_31_func_800B82E8.c",
        includeAsmPath: "build/ovl_31/asm/nonmatchings/ovl_31_func_800B82E8",
        vram: "0x800B82E8",
        dead: false,
      }],
    }));

    assert.match(
      canonicalStub(dir, "ovl_31_func_800B82E8"),
      /INCLUDE_ASM\("build\/ovl_31\/asm\/nonmatchings\/ovl_31_func_800B82E8", ovl_31_func_800B82E8\);/,
    );
    /* A function the graph does not place falls back to the executable's
       layout, which is the only one assumable without a graph. */
    assert.match(canonicalStub(dir, "func_80012345"), /INCLUDE_ASM\("build\/asm\/nonmatchings\/func_80012345", func_80012345\);/);
  } finally {
    cleanup();
  }
});

test("planning synthesizes a stub when the committed source no longer declares one", async () => {
  const { dir, cleanup } = scratch();
  try {
    const plan = await planPark({
      ...base,
      projectRoot: PROJECT_ROOT,
      runtimeDir: dir,
      attemptSource: ATTEMPT,
      committedSource: "int func_80012345(int a) { return a; }\n",
    });
    assert.match(plan.reasons.join("\n"), /synthesized a canonical stub/);
    assert.ok(plan.source.startsWith(canonicalStub(PROJECT_ROOT, "func_80012345").trimEnd().split("\n")[0]));
    assert.match(plan.source, /INCLUDE_ASM\("build\/asm\/nonmatchings\/func_80012345", func_80012345\);/);
  } finally {
    cleanup();
  }
});

test("the approval note carries the reason, findings, and preserved attempt", () => {
  const record: ParkRecord = {
    functionName: "func_80012345",
    reason: "asm-needs-human-approval",
    parkedAt: base.parkedAt,
    reachedTier: "gpt-5.6-sol",
    lastReport: "Oracle: func_80012345 verdict MISMATCH — 10/12 words (83.3%).",
    findings: [
      { kind: "embedded-asm", file: "src/func_80012345.c", line: 12, message: "Embedded assembly is forbidden", text: '__asm__("nop");' },
    ],
  };
  const note = buildApprovalNote(record, ATTEMPT, ["attempt is not safe to embed: dangling #endif"]);

  assert.match(note, /# func_80012345 — human decision needed/);
  assert.match(note, /asm-needs-human-approval/);
  assert.match(note, /embedded-asm/);
  assert.match(note, /sourcePolicy\.allowlist/);
  assert.match(note, /verdict MISMATCH/);
  assert.match(note, /Parking notes:.*dangling #endif/);
  assert.ok(note.includes("return a + 1;"));
});

test("the notes-only guard restores build inputs and leaves notes alone", () => {
  const { dir, cleanup } = scratch();
  try {
    writeFileSync(join(dir, "kept.c"), "original\n");
    const before = snapshotFiles(dir, ["kept.c", "created.c"]);

    writeFileSync(join(dir, "kept.c"), "tampered\n");
    writeFileSync(join(dir, "created.c"), "new\n");
    writeFileSync(join(dir, "note.md"), "evidence\n");

    const restored = restoreDrift(dir, before, ["kept.c", "created.c", "notes/file-groupings.md"]);

    assert.deepEqual(restored, ["created.c", "kept.c"]);
    assert.equal(readFileSync(join(dir, "kept.c"), "utf8"), "original\n");
    assert.equal(readFileSync(join(dir, "note.md"), "utf8"), "evidence\n");
    assert.equal(isNotesPath("notes/file-groupings.md"), true);
    assert.equal(isNotesPath("src/func_1.c"), false);
  } finally {
    cleanup();
  }
});
