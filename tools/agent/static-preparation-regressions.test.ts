import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareM2c } from "../build/prepareM2c.js";
import { ROOT, compileSource, disassembleObject } from "./decompToolchain.js";
import { extractSignaturesFromSource } from "./sdkTypes.js";
import { incomingSlots, prototypesIn, contradictionsAgainst } from "./calleeTruth.js";
import { auditM2cArithmetic } from "./m2cLimits.js";
import { buildMachineIrFrom } from "./machine-ir/index.js";
import { decodeFunction } from "./matching-reconstruction/decode.js";
import { assemble, type AsmLine } from "./matching-reconstruction/fixture-asm.js";
import { accessesFromIr, callAccessConstraints } from "./staticDiscovery.js";

const fixtures = "tools/agent/fixtures/static-preparation/";
const m2c = (file: string, args: string[] = []) => execFileSync("python3", ["tools/vendor/m2c/m2c.py", "--target", "mipsel-gcc-c", "--no-cache", ...args, fixtures + file], { cwd: ROOT, encoding: "utf8" });
const patched = (file: string, args: string[] = []) => execFileSync("python3", [prepareM2c(ROOT).script, "--target", "mipsel-gcc-c", "--no-cache", ...args, fixtures + file], { cwd: ROOT, encoding: "utf8" });
test("faithful context exposes upstream byte scaling; patched emission compiles to the original displacement", (t) => {
  const output = m2c("byte-offset.s", ["-f", "byte_offset", "--context", fixtures + "context.c"]);
  /* The current vendor emits +6 elements for an original +6 BYTE relation.
     This is intentionally a limitation measurement, not an acceptance claim. */
  assert.match(output, /return p \+ 6;/);
  const facts = auditM2cArithmetic(output, "raw.c");
  assert.equal(facts.length, 1); assert.equal(facts[0]!.strength, "conditional"); assert.ok(facts[0]!.span);
  const corrected = patched("byte-offset.s", ["-f", "byte_offset", "--context", fixtures + "context.c"]);
  assert.match(corrected, /\(u8 \*\) p \+ 6/);
  const dir = mkdtempSync(join(tmpdir(), "pointer-displacement-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, "candidate.c"); writeFileSync(source, '#include "common.h"\n' + corrected);
  const artifact = compileSource(source, dir, "byte_offset", { assemble: true, containerKind: "exe" });
  const instructions = disassembleObject(artifact.object!);
  assert.ok(instructions.some((i) => i.mnemonic === "addiu" && i.operands.at(-1) === "6"), "actual compiler preserves six BYTES, not 24");
});
test("known signatures retain actual types; patched unknown signatures retain ABI slots without invented scalar types", () => {
  const contextual = m2c("later-slot.s", ["-f", "later_slot", "--context", fixtures + "context.c"]);
  const withContext = prototypesIn(contextual, "raw.c").find((p) => p.kind === "definition")!;
  assert.equal(withContext.parameters, 3); assert.deepEqual(withContext.slots, [0, 1, 2]);
  const raw = m2c("later-slot.s", ["-f", "later_slot"]);
  assert.equal(prototypesIn(raw, "raw.c")[0]!.parameters, 1);
  assert.match(raw, /later_slot\(s32 arg2\)/);
  const corrected = patched("later-slot.s", ["-f", "later_slot"]);
  assert.match(corrected, /later_slot\(\? arg0, \? arg1, s32 arg2\)/);
  const contextualPatched = patched("later-slot.s", ["-f", "later_slot", "--context", fixtures + "context.c"]);
  assert.equal(prototypesIn(contextualPatched, "raw.c").find((p) => p.kind === "definition")!.parameters, 3);
});
test("vendored mechanism unit regressions run from the reproducible overlay", () => {
  const overlay = prepareM2c(ROOT);
  execFileSync("python3", ["-m", "unittest", "discover", "-s", "tests/unit"], { cwd: join(overlay.script, ".."), encoding: "utf8" });
});
test("typed positive/negative/variable byte arithmetic survives the production compiler", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "machine-byte-units-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const overlay = prepareM2c(ROOT);
  for (const displacement of [6, 12, -12, "variable"] as const) {
    const asm = join(dir, "fixture.s"), context = join(dir, "context.c");
    writeFileSync(context, "typedef unsigned int u32; u32 *fixture(u32 *p, int bytes);\n");
    writeFileSync(asm, `.text\nglabel fixture\njr $ra\n${displacement === "variable" ? "addu $v0, $a0, $a1" : `addiu $v0, $a0, ${displacement}`}\n`);
    const draft = execFileSync("python3", [overlay.script, "--target", "mipsel-gcc-c", "--no-cache", "-f", "fixture", "--context", context, asm], { encoding: "utf8", cwd: ROOT });
    const candidate = join(dir, "fixture.c"); writeFileSync(candidate, '#include "common.h"\n' + draft);
    const artifact = compileSource(candidate, join(dir, String(displacement)), "fixture", { assemble: true, containerKind: "exe" });
    const instructions = disassembleObject(artifact.object!);
    if (displacement === "variable") {
      assert.ok(instructions.some((i) => i.mnemonic === "addu")); assert.ok(!instructions.some((i) => i.mnemonic === "sll"));
    } else assert.ok(instructions.some((i) => i.mnemonic === "addiu" && i.operands.at(-1) === String(displacement)), `preserve ${displacement} machine bytes`);
  }
});
test("ABI positions align wide scalars and do not invent widths for unknown records", () => {
  assert.deepEqual(incomingSlots(["int", "double", "const int *", "long long"]), [0, 2, 4, 6]);
  assert.deepEqual(incomingSlots(["int", "UnresolvedRecord", "int"]), [0, null, null]);
});
test("ABI lower bounds do not turn wide or unknown-layout parameters into false arity conflicts", () => {
  const witness = { kind: "target" as const, where: "original", arity: { min: 3, max: 3 } };
  for (const signature of ["void wide(int x, double y);", "void opaque(Record x);", "void variadic(int x, ...);"]) {
    assert.deepEqual(contradictionsAgainst(prototypesIn(signature, "source.c")[0]!, witness, false), []);
  }
});
test("bounded multi-function m2c adds callee facts but does not justify the caller contract", () => {
  const one = m2c("related.s", ["-f", "fixture_caller"]);
  const many = m2c("related.s");
  assert.equal(extractSignaturesFromSource(one).length, 1);
  assert.equal(extractSignaturesFromSource(many).length, 2);
  assert.match(many, /u16 fixture_callee\(void \*arg0\)/);
  assert.match(many, /fixture_callee\(\);/, "the original caller passes through a0, which m2c still omits");
  assert.match(many, /arg0->unk2/);
});
test("original direct-call pointer constraints propagate without inferring a complete signature", () => {
  const caller = buildMachineIrFrom("caller", decodeFunction(assemble([
    ["addiu", "sp", "sp", -24], ["sw", "ra", 16, "sp"], ["jal", 0x80020000], ["addu", "a0", "a1", "zero"],
    ["lw", "ra", 16, "sp"], ["nop"], ["jr", "ra"], ["addiu", "sp", "sp", 24],
  ], 0x80010000)));
  const callee = buildMachineIrFrom("callee", decodeFunction(assemble([["lhu", "v0", 2, "a0"], ["jr", "ra"], ["nop"]], 0x80020000)));
  const effect = caller.ir.effects.find((e) => e.op.kind === "call")!;
  const carried = callAccessConstraints(caller, callee, effect);
  assert.equal(carried[0]!.base, "entry:a1"); assert.equal(carried[0]!.offset, 2); assert.equal(carried[0]!.width, 2);
  assert.equal(carried[0]!.signed, false); assert.equal(carried[0]!.evidence.length, 2);
});
const lift = (lines: AsmLine[]) => buildMachineIrFrom("frozen", decodeFunction(assemble(lines, 0x80010000)));
test("opaque address expressions break access proofs without discarding known surrounding accesses", () => {
  const report = lift([["lw", "v0", 0, "a0"], ["jr", "ra"], ["nop"]]);
  const address = report.ir.values.find((v) => v.op.kind === "load")!;
  if (address.op.kind !== "load") throw new Error("missing frozen load");
  report.ir.values[address.op.address]!.op = { kind: "opaque", source: { vram: 0x80010000, op: "unsupported" }, operands: [] };
  assert.deepEqual(accessesFromIr(report), []);
});
test("original-word discovery records partial widths/signedness/minimum offsets, never sizeof", () => {
  const report = lift([["lb", "v0", 3, "a0"], ["lhu", "v1", 10, "a0"], ["sw", "v1", 16, "a0"], ["jr", "ra"], ["nop"]]);
  const facts = accessesFromIr(report);
  assert.ok(facts.some((f) => f.offset === 3 && f.width === 1 && f.signed === true));
  assert.ok(facts.some((f) => f.offset === 10 && f.width === 2 && f.signed === false));
  assert.ok(facts.some((f) => f.offset === 16 && f.width === 4 && f.access === "store"));
  assert.ok(facts.every((f) => f.base === "entry:a0"));
});
