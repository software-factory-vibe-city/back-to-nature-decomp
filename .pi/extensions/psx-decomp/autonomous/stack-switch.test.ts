import { strict as assert } from "node:assert";
import { test } from "node:test";
import { stackPointerSwitch } from "./source-policy.ts";

/* The six instructions this target actually uses, at all three sites. */
test("the scratchpad stack switch and its restore are recognised", () => {
  assert.ok(stackPointerSwitch('__asm__ volatile("addu $8,%0,$0" : : "r"(slot) : "$8");'));
  assert.ok(stackPointerSwitch('__asm__ volatile("sw $sp,0($8)");'));
  assert.ok(stackPointerSwitch('__asm__ volatile("addiu $8,$8,-4");'));
  assert.ok(stackPointerSwitch('__asm__ volatile("addu $sp,$8,$0");'));
  assert.ok(stackPointerSwitch('__asm__ volatile("addiu $sp,$sp,4");'));
  assert.ok(stackPointerSwitch('__asm__ volatile("lw $sp,0($sp)");'));
});

test("the whole idiom in one statement is recognised too", () => {
  assert.ok(stackPointerSwitch(
    '__asm__ volatile("addu $8,%0,$0\\n\\tsw $sp,0($8)\\n\\taddiu $8,$8,-4\\n\\taddu $sp,$8,$0" : : "r"(slot) : "$8");',
  ));
});

test("an output operand is refused: it could deliver a value to C", () => {
  assert.equal(stackPointerSwitch('__asm__ volatile("addu $sp,%0,$0" : "=r"(x) : "r"(slot));'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("move $8,$sp" : "+r"(x));'), false);
});

test("memory access other than saving and restoring $sp is refused", () => {
  /* Storing a C value through a pointer, or reading one, is not a stack
     switch however it is dressed. */
  assert.equal(stackPointerSwitch('__asm__ volatile("sw %0,0($8)" : : "r"(v));'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("lw $8,0($9)");'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("lbu $8,0($sp)");'), false);
});

test("arithmetic on anything but the stack pointer is refused", () => {
  assert.equal(stackPointerSwitch('__asm__ volatile("mult $8,$9");'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("sll $8,$9,2");'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("addu $16,$17,$18");'), false, "callee-saved registers are not scratch");
  assert.equal(stackPointerSwitch('__asm__ volatile("jal func");'), false);
});

test("an empty barrier and an asm label are not stack switches", () => {
  assert.equal(stackPointerSwitch('__asm__ volatile("" ::: "memory");'), false);
  assert.equal(stackPointerSwitch('extern s32 _D_8005E1B0[1] __asm__("D_8005E1B0");'), false);
});

test("a plain C line is not a stack switch", () => {
  assert.equal(stackPointerSwitch("    sp = 0;"), false);
  assert.equal(stackPointerSwitch(""), false);
});

test("assembly that does nothing is not a stack switch", () => {
  /* `nop` breaks no rule above, because it does nothing — and "does nothing"
     is a different claim from "moves the stack pointer". Without this the
     classification would exempt every no-op asm statement in the project. */
  assert.equal(stackPointerSwitch('__asm__("nop");'), false);
  assert.equal(stackPointerSwitch('__asm__ __volatile__("nop");'), false);
  assert.equal(stackPointerSwitch('__asm__ volatile("nop\\n\\tnop");'), false);
  /* And a copy between two scratch registers, which names neither $sp nor a C
     operand, buys nothing and is refused with them. */
  assert.equal(stackPointerSwitch('__asm__ volatile("move $8,$9");'), false);
});
