# The scratchpad stack switch — what it is, why the developers wrote it, and how

Three functions in this target move `$sp` to the PlayStation scratchpad for the
duration of a call and put it back afterwards. This note records what the
hardware makes that worth doing, the evidence that it was deliberate and
measured, and the reconstruction of the source form — because no C construct
moves the stack pointer, so "what did the original source look like" has a
narrower answer here than usual.

## The instructions

Byte-identical at all three sites. Save:

```
  addu   $t0, <reg>, $zero      ; <reg> holds 0x1F8003FC
  sw     $sp, 0x0($t0)          ; park the caller's stack pointer at the top of scratchpad
  addiu  $t0, $t0, -0x4
  addu   $sp, $t0, $zero        ; run on the scratchpad from 0x1F8003F8 downwards
```

Restore:

```
  addiu  $sp, $sp, 0x4          ; back up to the saved slot
  lw     $sp, 0x0($sp)          ; and reload the caller's stack pointer
```

| site | what runs on the scratchpad stack |
|---|---|
| `func_8001BFEC` +0x28 | `func_8001D6B8` |
| `func_8001BFEC` +0x80 (inside the per-element loop) | `func_8001C37C` |
| `func_8001C0D4` prologue → epilogue | the whole body, `func_8001C1C0` included |

## Why

The PS1's R3000A has a 1 KB data cache that the console does not wire up as a
cache. It is exposed as directly addressed fast memory at `0x1F800000`–
`0x1F8003FF` — the *scratchpad* — and main RAM is left with **no data cache at
all**. Every load and store to a stack frame in main RAM is a bus access,
contended with the GPU and with DMA; the same access to the scratchpad is
single-cycle and never leaves the CPU.

So a hot call tree pays for its locals, its spills and its saved registers on
every single access. Pointing `$sp` at the scratchpad moves *all of it* —
frames, spill slots, register saves, arguments beyond the fourth — into fast
memory for the duration, without changing one line of the callee. That is the
appeal: it is a whole-subtree optimisation applied from the outside, and the
callees need not know.

Both call sites are geometry: `func_8001BFEC` walks a model's elements calling
`func_8001C37C` per element, inside a `PushMatrix`/`PopMatrix` pair, and
`func_8001C37C` in turn calls the vertex-bounds and transform helpers. This is
the per-frame draw path, which is exactly where the trick pays.

## The evidence that it was deliberate

**The depth was measured.** The scratchpad stack has 1016 usable bytes below
the saved-`$sp` slot. The deepest thing that runs on it:

| function | frame |
|---|---|
| `func_8001C37C` | 0x40 |
| `func_8001D6B8` | 0x20 |
| `func_8001D2D8`, `func_8001E158`, `HasTriangleVertexXInBounds` | leaf, no frame |

Peak depth is under 128 bytes against 1016 available. Someone checked. The
idiom is also **not** applied to the engine at large — `0x1F8003FC` is the only
scratchpad address in the entire image, and these six references are all of
them. The scratchpad is reserved for this and nothing else.

**It is not reentrant, and it did not need to be.** The saved `$sp` goes to a
fixed address, so a nested switch would overwrite the outer save. The three
sites never nest: `func_8001BFEC` restores before each subsequent switch, and
`func_8001C0D4`'s callees do not switch.

**`$sp` stays 8-byte aligned.** `0x1F8003F8` satisfies the o32 requirement, so
the `-0x4` is the smallest step that both clears the saved slot and keeps the
ABI. A `-0x8` would have wasted four bytes; a `-0x0` would have let the first
callee's frame overwrite the saved pointer.

## How they wrote it

Inline assembly in a macro, in a project header. Three lines of evidence:

1. **No alternative exists.** There is no C expression, no PSY-Q call, no GCC
   builtin and no compiler flag that moves `$sp`. `alloca` moves it but never
   *sets* it, and cannot leave it moved across a call.
2. **The temp register is hard-coded and the operand register is not.** `$t0`
   is used at all three sites; the register feeding it is `$v0` twice and `$s1`
   once, the latter hoisted out of the loop by the compiler. That is exactly
   what an `"r"` input constraint produces: the template names `$8` literally,
   the compiler picks whatever it likes for `%0`, and the copy
   `addu $t0, %0, $zero` is the seam between the two. Had the address been
   written into the template as a literal, there would be no copy; had the
   whole thing been hand-written assembly, `$t0` would not need a copy at all.
3. **The sequence is byte-identical at three sites**, including the redundant
   copy. Hand-repeated assembly drifts; a macro does not.

The reconstruction, then, is a pair of macros:

```c
#define SP_TO_SCRATCH(slot)                      \
    __asm__ volatile(                            \
        "addu $8,%0,$0\n\t"                      \
        "sw $sp,0($8)\n\t"                       \
        "addiu $8,$8,-4\n\t"                     \
        "addu $sp,$8,$0"                         \
        : : "r"(slot) : "$8")

#define SP_FROM_SCRATCH()                        \
    __asm__ volatile(                            \
        "addiu $sp,$sp,4\n\t"                    \
        "lw $sp,0($sp)")
```

used as

```c
    slot = (unsigned int *)0x1F8003FC;
    SP_TO_SCRATCH(slot);
    func_8001D6B8();
    SP_FROM_SCRATCH();
```

The address is a variable rather than a literal in the template because the
compiler materialises it — `lui`/`ori` in the caller, in a register of its
choosing — and hoists it out of `func_8001BFEC`'s loop into `$s1`. A literal
inside the template could not be hoisted, and the loop would re-materialise it
every iteration. It does not.

## What this means for the clean-source policy

`.pi/autodecomp.json`'s allowlist exists to record that *for this function*,
assembly was judged the right answer. That is the wrong shape for this
construct: it is the right answer for every function that runs on the
scratchpad stack, for a reason that has nothing to do with the function. So it
is a **classification**, alongside the empty memory barrier —
`sourcePolicy.allowStackPointerSwitch`, on by default — rather than a
per-function exception a human grants one at a time.

`stackPointerSwitch` in `.pi/extensions/psx-decomp/autonomous/source-policy.ts`
recognises it narrowly enough that nothing travels with it:

- **no output operands**, so the statement cannot deliver a value to C;
- **every destination is `$sp` or a caller-saved temp**, so it cannot write a
  callee-saved register or a C variable's home;
- **the only memory operations are storing `$sp` and loading `$sp`**, so it can
  neither read nor write anything else;
- the instruction set is limited to copies, an immediate offset, and those two
  memory operations.

What is left is precisely: compute an address into a temp, park `$sp` in
memory, install a new `$sp`, and undo it. `notes/../stack-switch.test.ts`
pins the boundary — an output operand, a store of anything but `$sp`, a load
into anything but `$sp`, a shift, a multiply, a call, or a callee-saved
destination are all refused.

## Status

- `func_8001C0D4` — byte-exact, 59/59, unparked under this classification.
- `func_8001BFEC` — 53/58 with the switch recognised; the remaining five words
  are a `$v0`/`$v1` ranking difference in local-alloc, not a policy question.
- `func_8001231C` — *not* this case. It byte-matches only by pinning seventeen
  hard registers and writing `lui`/`ori` as `__asm__`; that is the disassembly
  in C syntax, and it stays parked for a real reconstruction.
