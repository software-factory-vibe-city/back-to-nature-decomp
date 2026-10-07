import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { injectStaticChain, verifyChainInjection } from "./staticChainInjection.js";
import { nestedFunctionCensus, chainRow } from "../diagnostics/nestedFunctionScan.js";
import { analyzeCSource, applyCSourceEdits, capturePrevRetSites, migrateCapturePrevRet } from "./cSourceGuard.js";
import { compileSource, sourcePathFor } from "./decompToolchain.js";
import { compareFunction } from "../lib/functionOracle.js";
import { validateVariantSource } from "./variant-lab/manifest.js";
const census = nestedFunctionCensus();
const VALIDATION_HEADER = `#include "common.h"\n/* Original D062C accesses, isolated validation context only. */\ntypedef struct { u8 pad0[0x38]; s32 rank38; u8 pad3C[4]; s32 rank40; u8 pad44[0x14]; s32 rank58; u8 pad5C[4]; s32 rank60; } Ovl11RankPair;\nextern u16 D_80123A00[9];\n`;

test("AST migration is exact/idempotent and never changes mentions, disabled code, aliases or other pins", () => {
  const source = '/* register s32 hidden asm("$2"); */\n#if 0\nregister s32 disabled asm("$2");\n#endif\nregister s32 hidden asm("$2");\nextern s32 alias asm("name");\nregister s32 other asm("$3");\ns32 f(void) { return hidden; }\n';
  const changed = migrateCapturePrevRet(source);
  assert.ok(changed.includes('CAPTURE_PREV_RET(hidden);'));
  assert.ok(changed.includes('register s32 disabled asm("$2");'));
  assert.ok(changed.includes('register s32 other asm("$3");'));
  assert.equal(migrateCapturePrevRet(changed), changed);
  assert.equal(capturePrevRetSites(changed).length, 1);
  assert.equal(capturePrevRetSites('/* CAPTURE_PREV_RET(x); */\nconst char *s="CAPTURE_PREV_RET(x);";\n').length, 0);
});

test("dead-spill injection compiles to the original leaf and its claim gate rejects wrong slots/unknown relocations", t => {
  const name = "ovl_11_func_800D0600", row = chainRow(census, name)!;
  const source = `#include "common.h"\ns32 ${name}(s32 a, s32 b) {\n if (a == b) return 0;\n if (a < b) return 1;\n return 2;\n}\n`;
  const injection = injectStaticChain(source, row, "");
  assert.equal(injection.changed, true); assert.equal(injection.status, "pending-oracle");
  assert.equal(capturePrevRetSites(injection.source)[0]!.scope, "function");
  assert.match(injection.source, /spill N=0/);
  const retry = injectStaticChain(injection.source, row, "");
  assert.equal(retry.changed, false); assert.equal(retry.status, "pending-oracle");
  assert.equal(retry.claims.length, injection.claims.length);
  const dir = mkdtempSync(join(tmpdir(), "chain-leaf-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "draft.c"); writeFileSync(path, injection.source);
  const art = compileSource(path, dir, name, { assemble: true });
  const oracle = compareFunction(name, { objectPath: art.object!, container: "ovl_11" });
  assert.equal(oracle.verdict, "match"); verifyChainInjection(injection, oracle); assert.equal(injection.status, "verified");
  verifyChainInjection(retry, oracle); assert.equal(retry.status, "verified");
  const bad = structuredClone(injection); bad.claims.find(c => c.kind === "spill")!.offset = 20;
  verifyChainInjection(bad, oracle); assert.equal(bad.status, "failed");
  const unresolved = structuredClone(oracle); unresolved.candidateWords[0]!.undetermined = "missing symbol";
  verifyChainInjection(injection, unresolved); assert.equal(injection.status, "failed");
});

test("a byte-proven dead m2c unset-$v0 spill is replaced through AST; live/conditional errors stay unresolved", () => {
  const row = chainRow(census, "ovl_11_func_800D0600")!;
  const source = 's32 ovl_11_func_800D0600(s32 a, s32 b) { s32 sp0; sp0 = M2C_ERROR(/* Read from unset register $v0 */); return a < b; }';
  const injection = injectStaticChain(source, row, "");
  assert.ok(injection.source.includes("s32 sp0[2];"));
  assert.ok(injection.source.includes("sp0[0] = phantom;"));
  assert.equal(injection.source.includes("M2C_ERROR"), false);
  for (const tail of ['return sp0;', 'return a < b;']) {
    const unresolved = `s32 ovl_11_func_800D0600(s32 a,s32 b) { s32 sp0; ${tail.includes('sp0') ? '' : 'if (a)'} sp0 = M2C_ERROR(/* Read from unset register $v0 */); ${tail} }`;
    assert.ok(injectStaticChain(unresolved, row, "").source.includes("M2C_ERROR"));
  }
});

test("paired caller injection uses the actual complete prototype, rewrites only calls and is idempotent", t => {
  const name = "ovl_11_func_800D062C", row = chainRow(census, name)!;
  const source = `#include "common.h"\n#include "validation.h"\nu16 ${name}(Ovl11RankPair *p) {\n s32 a; s32 b;\n a = ovl_11_func_800D0600(p->rank38,p->rank58);\n b = ovl_11_func_800D0600(p->rank40,p->rank60);\n return D_80123A00[a*3+b];\n}\n`;
  const context = "s32 ovl_11_func_800D0600(s32 a, s32 b);";
  const injection = injectStaticChain(source, row, context);
  assert.equal(injection.status, "pending-oracle"); assert.match(injection.source, /auto s32 .*\(s32 a, s32 b\) __asm__\("ovl_11_func_800D0600"\)/);
  assert.equal(injection.claims.filter(c => c.kind === "caller").length, 2);
  assert.equal(validateVariantSource(injection.source).filter(f => f.kind === "forbidden-construct").length, 0, "asm label is not instruction assembly");
  assert.equal(validateVariantSource('s32 f(void) { auto s32 local(s32 a, s32 b) __asm__("callee"); return local(1,2); }').length, 0);
  const retry = injectStaticChain(injection.source, row, context);
  assert.equal(retry.changed, false); assert.equal(retry.status, "pending-oracle");
  for (const context of ['s32 ovl_11_func_800D0600();', 's32 ovl_11_func_800D0600(s32, ...);', '#ifdef X\ns32 ovl_11_func_800D0600(s32,s32);\n#endif', 's32 ovl_11_func_800D0600(s32,s32);\nvoid broken(']) {
    const unavailable = injectStaticChain(source, row, context);
    assert.equal(unavailable.changed, false); assert.equal(unavailable.status, "incomplete");
  }
  const dir = mkdtempSync(join(tmpdir(), "chain-caller-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "validation.h"), VALIDATION_HEADER);
  const path = join(dir, "draft.c"); writeFileSync(path, injection.source);
  const art = compileSource(path, dir, name, { assemble: true });
  const oracle = compareFunction(name, { objectPath: art.object!, container: "ovl_11" });
  verifyChainInjection(injection, oracle); assert.equal(injection.status, "verified");
  assert.equal(oracle.verdict, "mismatch", "partial chain verification must not pretend the table-address schedule is a whole-function MATCH");
});

test("save-forward is file-scope, visibly incomplete; ambiguous subforms inject only proven liveness", () => {
  const row = chainRow(census, "func_8001E9F8")!;
  const source = '#include "common.h"\ns32 func_8001E9F8(void) { return 0; }\n';
  const injection = injectStaticChain(source, row, "");
  assert.equal(injection.status, "incomplete"); assert.equal(capturePrevRetSites(injection.source)[0]!.scope, "file");
  assert.match(injection.findings.join("\n"), /incomplete.*position/);
  assert.match(injection.source, /TODO: phantom = chain_saved; before func_8001E878/);
  const retry = injectStaticChain(injection.source, row, "");
  assert.equal(retry.changed, false); assert.equal(retry.status, "incomplete");
  const ambiguous = chainRow(census, "ovl_11_func_8010EE5C")!;
  const other = injectStaticChain(`void ${ambiguous.function}(void) { }`, ambiguous, "");
  assert.equal(other.changed, true); assert.equal(other.status, "incomplete");
  assert.equal(other.claims.length, 1); assert.equal(other.claims[0]!.kind, "entry");
});

test("every proven recipe selects the right scope; matched sources inject nothing, including both caller emulations", () => {
  for (const row of census.rows.filter(r => r.callee && r.callee.form !== "undetermined")) {
    const skeleton = `#include "common.h"\ns32 ${row.function}(void) { return 0; }\n`;
    const injection = injectStaticChain(skeleton, row, "");
    assert.equal(capturePrevRetSites(injection.source)[0]!.scope, row.callee!.form === "save-forward" ? "file" : "function", row.id);
    const live = readFileSync(sourcePathFor(row.function), "utf8");
    assert.equal(injectStaticChain(live, row, "").changed, false, row.id);
  }
  for (const name of ["func_8001EAE4", "ovl_11_func_800F5160", "ovl_19_func_800B8E88"])
    assert.equal(injectStaticChain(readFileSync(sourcePathFor(name), "utf8"), chainRow(census, name), "").changed, false, name);
});

test("unknown call correspondence, conditional definitions and malformed input are surfaced without guesses", () => {
  const row = chainRow(census, "ovl_11_func_800D062C")!;
  const source = `void ${row.function}(void) { ovl_11_func_800D0600(1,2); }`;
  assert.equal(injectStaticChain(source, row, "s32 ovl_11_func_800D0600(s32,s32);").changed, false);
  assert.equal(injectStaticChain(`#ifdef X\n${source}\n#endif`, row, "").changed, false);
  assert.equal(injectStaticChain("void broken(", row, "").status, "incomplete");
  const zero = capturePrevRetSites('CAPTURE_PREV_RET(x);\nvoid f(void) { CAPTURE_PREV_RET(x,y); }');
  assert.equal(zero[0]!.valid, true); assert.equal(zero[1]!.valid, false);
  assert.throws(() => applyCSourceEdits("void f(void) {}", [{ start: 5, end: 10, text: "bad" }, { start: 8, end: 9, text: "x" }]), /overlapping/);
});
