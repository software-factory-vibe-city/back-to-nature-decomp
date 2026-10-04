import { test } from "node:test";
import assert from "node:assert/strict";
import { overrideSymbolsFrom, generateM2cContextFromHeader } from "./classifyGlobals.js";
test("an address in a comment/string does not suppress a generated declaration", () => {
  const symbols = overrideSymbolsFrom('/* D_8005E2F0 is related but not declared */\nextern int D_80000000;\nstatic char *description = "D_8005E33A";\n');
  assert.deepEqual([...symbols], ["D_80000000"]);
});
test("real macro-backed views and backing declarations suppress only witnessed objects", () => {
  const symbols = overrideSymbolsFrom('extern unsigned char backing[128] asm("D_80000000");\n#define D_80000000 backing\n#define D_80000004 (*((unsigned short (*)[4])backing))\n/* unrelated D_80000008 */\n');
  assert.ok(symbols.has("D_80000000")); assert.ok(symbols.has("D_80000004")); assert.equal(symbols.has("D_80000008"), false);
});
test("effective macro-array projection retains the array shape, not a scalar guess", () => {
  const text = generateM2cContextFromHeader('extern unsigned char backing[128];\n#define D_80000004 (*((unsigned short (*)[4])backing))\n', ["D_80000004"]);
  assert.match(text, /extern unsigned short D_80000004\[4\]/);
});
