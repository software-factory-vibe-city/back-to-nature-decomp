import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROOT } from "./decompToolchain.js";
import { parseAsm, resolveFunctionAsm } from "./scanReadBeforeDef.js";

/**
 * The same two-block loop in the two label dialects the project's assembly
 * trees use: splat's nonmatchings spells local labels `.L80000014`, the
 * disassembler's per-function dump spells them `_80000014`. Both forms occur in
 * both trees.
 */
function loop(label: (address: string) => string): string {
  return [
    "glabel func_80000000",
    `    /* 000000 80000000 00000000 */  b           ${label("80000014")}`,
    "    /* 000004 80000004 00000000 */   nop",
    `${label("80000008")}:`,
    "    /* 000008 80000008 00000000 */  addiu       $v0, $v0, 0x1",
    "    /* 00000C 8000000C 00000000 */  jr          $ra",
    "    /* 000010 80000010 00000000 */   nop",
    `${label("80000014")}:`,
    "    /* 000014 80000014 00000000 */  addiu       $v0, $zero, 0x0",
    `    /* 000018 80000018 00000000 */  b           ${label("80000008")}`,
    "    /* 00001C 8000001C 00000000 */   nop",
    "",
  ].join("\n");
}

test("both local-label dialects parse to the same labels and branch targets", () => {
  const dotL = parseAsm(loop((address) => `.L${address}`));
  const underscore = parseAsm(loop((address) => `_${address}`));

  /* An unparsed label costs a basic-block edge, and a lost back-edge is what
   * makes a linear scan report a false entry-liveness finding. */
  assert.equal(dotL.labels.size, 2);
  assert.equal(underscore.labels.size, 2);
  assert.deepEqual([...underscore.labels.values()], [...dotL.labels.values()]);

  const targets = (parsed: ReturnType<typeof parseAsm>) =>
    parsed.instructions.map((instruction) => instruction.labelTarget !== undefined);
  assert.deepEqual(targets(underscore), targets(dotL));
  assert.equal(targets(underscore).filter(Boolean).length, 2);
});

test("a label-shaped operand is only a branch target when it is a local label", () => {
  const parsed = parseAsm([
    "glabel func_80000000",
    "    /* 000000 80000000 00000000 */  j           func_80000010",
    "    /* 000004 80000004 00000000 */   nop",
    "",
  ].join("\n"));
  assert.equal(parsed.instructions[0]!.labelTarget, undefined);
});

test("function assembly falls back to the disassembler dump when splat has no stub", () => {
  assert.equal(resolveFunctionAsm("func_00000000"), null);

  /* build/asm/nonmatchings only holds functions still stubbed with INCLUDE_ASM,
   * so an already-matched function resolves only through build/functions. */
  const dumped = join(ROOT, "build/functions/func_8001205C.s");
  const stub = join(ROOT, "build/asm/nonmatchings/func_8001205C/func_8001205C.s");
  if (existsSync(dumped) && !existsSync(stub)) {
    assert.equal(resolveFunctionAsm("func_8001205C"), dumped);
  }
});
