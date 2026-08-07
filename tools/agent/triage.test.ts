import { strict as assert } from "node:assert";
import { test } from "node:test";
import { detectBackendPacket, type TargetFacts } from "./triage.js";
import { analyzeFrame } from "./frameMap.js";
import { analyzeReturnValue } from "./frameMap.js";
import type { DisassembledInstruction } from "./decompToolchain.js";

function code(lines: string[]): DisassembledInstruction[] {
  return lines.map((line, index) => {
    const [mnemonic, rest = ""] = line.trim().split(/\s+(.*)/);
    const operands = rest
      ? rest.split(/,(?![^(]*\))/).map((operand) => operand.trim()).filter(Boolean)
      : [];
    return {
      address: index * 4,
      mnemonic,
      operands,
      operandText: operands.join(","),
      raw: line.trim(),
    };
  });
}

function facts(lines: string[]): TargetFacts {
  const instructions = code(lines);
  return {
    frame: analyzeFrame(instructions),
    instructions,
    returnValue: analyzeReturnValue(instructions, []),
    raStores: [],
  };
}

/* func_800140C8's prefix. These five machine instructions were one
 * movstrsi_internal; treating them as five scheduling decisions is what made
 * the residual unreachable through any scalar source. */
test("backend-packet: a two-byte load-batch/store-batch run is reported", () => {
  const findings = detectBackendPacket(facts([
    "addiu $a3, $v0, %lo(D_8005E2AC)",
    "lb $v1, 0x0($a3)",
    "lb $a1, 0x1($a3)",
    "sb $v1, 0x10($sp)",
    "sb $a1, 0x11($sp)",
  ]));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, "backend-packet");
  assert.ok(findings[0].summary.includes("2 bytes") || findings[0].summary.includes("2 x 1-byte"));
  assert.ok(
    findings[0].evidence.some((line) => line.includes("does not prove")),
    "the finding must state compatibility rather than provenance",
  );
});

test("backend-packet: a four-word run is reported", () => {
  const findings = detectBackendPacket(facts([
    "lw $t3, 0x0($a0)",
    "lw $t4, 0x4($a0)",
    "lw $v1, 0x8($a0)",
    "lw $a2, 0xC($a0)",
    "sw $t3, 0x0($a3)",
    "sw $t4, 0x4($a3)",
    "sw $v1, 0x8($a3)",
    "sw $a2, 0xC($a3)",
  ]));

  assert.equal(findings.length, 1);
  assert.ok(
    findings[0].evidence.some((line) => line.includes("move_by_pieces")),
    "a word-aligned run of this size must carry the move_by_pieces caveat",
  );
});

/* Interleaved load/store pairs are exactly what move_by_pieces emits, and a
 * member-wise scalar source reproduces them byte-for-byte. Firing here would
 * send an investigation after an aggregate copy that does not exist. */
test("backend-packet: interleaved copies are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "sw $v1, 0x0($a0)",
    "lw $v0, 0x4($a1)",
    "sw $v0, 0x4($a0)",
    "lw $v1, 0x8($a1)",
    "sw $v1, 0x8($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: mismatched value registers are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lw $v0, 0x4($a1)",
    "sw $v0, 0x0($a0)",
    "sw $v1, 0x4($a0)",
  ]));
  assert.deepEqual(findings, [], "a block mover stores in the order it loaded");
});

test("backend-packet: noncontiguous offsets are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lw $v0, 0x10($a1)",
    "sw $v1, 0x0($a0)",
    "sw $v0, 0x10($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: mixed widths are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lh $v0, 0x4($a1)",
    "sw $v1, 0x0($a0)",
    "sh $v0, 0x4($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: ordinary code produces no finding", () => {
  const findings = detectBackendPacket(facts([
    "addiu $sp, $sp, -0x18",
    "sw $ra, 0x14($sp)",
    "jal func_80011370",
    "addu $a0, $s0, $zero",
    "lw $ra, 0x14($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x18",
  ]));
  assert.deepEqual(findings, []);
});
