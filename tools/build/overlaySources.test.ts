import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "../lib/psxExeInfo.js";

test("overlay builds select configured functions without deleting retired source files", (t) => {
  const root = mkdtempSync(join(tmpdir(), "overlay-sources-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["configs/splat", "src/overlays/ovl_test"]) mkdirSync(join(root, dir), { recursive: true });
  const original = readFileSync(join(ROOT, "Makefile"), "utf8");
  const start = original.indexOf("define OverlayRules\n"), end = original.indexOf("\nendef", start) + "\nendef".length;
  writeFileSync(join(root, "Makefile"), "BUILD_DIR := build\n" + original.slice(start, end) +
    "\n$(eval $(call OverlayRules,ovl_test))\n.PHONY: selected\nselected:\n\t@echo $(ovl_test_C_SRCS)\n");
  const live = "src/overlays/ovl_test/head.c", retired = "src/overlays/ovl_test/case.c";
  writeFileSync(join(root, live), "int head(void) {return 1;}\n");
  const stub = 'INCLUDE_ASM("build/nonexistent/case", case);\n';
  writeFileSync(join(root, retired), stub);
  const config = join(root, "configs/splat/ovl_test.yaml");
  const selected = () => execFileSync("make", ["--no-print-directory", "selected"], { cwd: root, encoding: "utf8" }).trim().split(/\s+/);
  writeFileSync(config, "subsegments:\n  - [0x0, .rodata, head]\n  - [0x10, c, head]\n  - [0x18, c, case]\n  - [0x20, data]\n");
  assert.deepEqual(selected(), [live, retired]);
  writeFileSync(config, "subsegments:\n  - [0x0, .rodata, head]\n  - [0x10, c, head]\n  - [0x20, data]\n");
  assert.deepEqual(selected(), [live]);
  assert.equal(readFileSync(join(root, retired), "utf8"), stub, "retired source remains untouched, with no standalone asm prerequisite");
});
