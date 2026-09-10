import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadContainer } from "../../lib/container.js";
import { resolveSignature } from "./callee-signature.js";

const exe = loadContainer("exe");

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