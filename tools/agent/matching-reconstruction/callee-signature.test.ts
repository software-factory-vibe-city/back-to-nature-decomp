import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadContainer } from "../../lib/container.js";
import { resolveSignature, inferSignatureRange } from "./callee-signature.js";
import type { SymExpr } from "./types.js";

const exe = loadContainer("exe");

const ENTRY_A0: SymExpr = { kind: "entry", register: "a0" };
const ENTRY_A1: SymExpr = { kind: "entry", register: "a1" };
const ENTRY_A2: SymExpr = { kind: "entry", register: "a2" };
const ENTRY_A3: SymExpr = { kind: "entry", register: "a3" };
const CONST_42: SymExpr = { kind: "const", value: 42 };
const CONST_99: SymExpr = { kind: "const", value: 99 };

function makeArgSnapshot(
  a0: SymExpr, a1: SymExpr, a2: SymExpr, a3: SymExpr,
): SymExpr[] {
  return [a0, a1, a2, a3];
}

test("a matched callee resolves to its real arity and return type from the header", { skip: !exe }, () => {
  /* func_8001205C is matched (real C in src/func_8001205C.c) and declared in
   * include/functions.h as `s32 func_8001205C(void);`. */
  const result = resolveSignature("func_8001205C", 0x8001205c, exe!);
  assert.ok(!("unknown" in result), JSON.stringify(result));
  if ("unknown" in result) return;
  assert.equal(result.arity, 0);
  assert.equal(result.returnsValue, true);
  assert.equal(result.returnType, "s32");
  assert.equal(result.source, "matched");
});

test("an SDK callee resolves from the vendored prototype", { skip: !exe }, () => {
  /* GetDispEnv is a PSY-Q GPU library function: DISPENV *GetDispEnv(DISPENV *env).
   * Vendored, so it predates any reconstruction decision, with a fixed arity. */
  const result = resolveSignature("GetDispEnv", undefined, exe!);
  assert.ok(!("unknown" in result), JSON.stringify(result));
  if ("unknown" in result) return;
  assert.equal(result.source, "sdk");
  assert.equal(result.arity, 1, "GetDispEnv takes one argument");
  assert.ok(result.returnsValue, "GetDispEnv returns a value");
});

test("an unresolved name returns unknown, never a guess", { skip: !exe }, () => {
  const result = resolveSignature(null, undefined, exe!);
  assert.ok("unknown" in result, "no symbol must never fabricate a signature");
});

test("a bare stub with no signature evidence returns unknown", { skip: !exe }, () => {
  /* A function that exists in the binary but is not matched, is not an SDK
   * entry point, and whose target code yields nothing → unknown. */
  const result = resolveSignature("definitely_not_a_function", 0x80000000, exe!);
  assert.ok("unknown" in result, JSON.stringify(result));
});

test("a matched callee resolves from an overlay container via cross-container fallback", { skip: !exe }, () => {
  /* func_8001ABF0 is matched (src/func_8001ABF0.c) and declared in the exe's
   * functions.h. An overlay calling it should resolve through the
   * cross-container fallback (the overlay's own header does not declare
   * it). */
  const ovlContainer = loadContainer("ovl_11");
  if (!ovlContainer) return; /* skip if overlay not loaded */
  const result = resolveSignature("func_8001ABF0", 0x8001abf0, ovlContainer);
  assert.ok(!("unknown" in result), `should resolve cross-container: ${JSON.stringify(result)}`);
  if ("unknown" in result) return;
  assert.equal(result.arity, 2);
  assert.equal(result.returnsValue, false);
  assert.equal(result.source, "matched");
});

test("inferSignatureRange: non-passthrough a0 gives arityHi=1 from caller side", () => {
  /* Caller set a0 to a const (non-passthrough), left a1..a3 as entry. */
  const args = makeArgSnapshot(CONST_42, ENTRY_A1, ENTRY_A2, ENTRY_A3);
  const result = inferSignatureRange(null, undefined, exe!, args, new Set(), 1);
  assert.equal(result.arityLo, 0);
  assert.equal(result.arityHi, 1, "a0 is non-passthrough → arityHi=1");
  assert.equal(result.returns, "unknown");
});

test("inferSignatureRange: consumed call result yields returns=yes", () => {
  const args = makeArgSnapshot(CONST_42, CONST_99, ENTRY_A2, ENTRY_A3);
  const result = inferSignatureRange(null, undefined, exe!, args, new Set([1]), 1);
  assert.equal(result.returns, "yes", "consumed result → returns=yes");
  assert.equal(result.arityHi, 2, "highest non-passthrough arg index + 1");
});

test("inferSignatureRange: unconsumed call result yields returns=unknown", () => {
  const args = makeArgSnapshot(CONST_42, ENTRY_A1, ENTRY_A2, ENTRY_A3);
  const result = inferSignatureRange(null, undefined, exe!, args, new Set(), 1);
  assert.equal(result.returns, "unknown", "unconsumed → still unknown, not no");
});

test("inferSignatureRange: all entry args gives arityHi=0", () => {
  /* All captured args are bare entry registers — the caller wrote nothing. */
  const args = makeArgSnapshot(ENTRY_A0, ENTRY_A1, ENTRY_A2, ENTRY_A3);
  const result = inferSignatureRange(null, undefined, exe!, args, new Set(), 1);
  assert.equal(result.arityLo, 0);
  assert.equal(result.arityHi, 0, "no non-passthrough → arityHi=0");
});

test("inferSignatureRange: non-passthrough a0,a1,a2 gives arityHi=3", () => {
  const args = makeArgSnapshot(CONST_42, CONST_99, { kind: "const", value: 7 }, ENTRY_A3);
  const result = inferSignatureRange(null, undefined, exe!, args, new Set(), 1);
  assert.equal(result.arityHi, 3, "highest non-passthrough is a2 (index 2) → arityHi=3");
});