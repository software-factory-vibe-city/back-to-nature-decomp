# func_8001A970 — loop construct choice flips global allocation ($t0 vs $a3)

**Status: SOLVED in clean C (2026-07-26).** The matching source uses a `for`
loop for the digit-extraction phase and a `do-while` for the display-rendering
phase. All 67 target instructions match exactly, with no register pins,
barriers, or assembly. `make check` byte-identical.

Related: `notes/research/func_8001E7DC-allocator-preference-battle.md`
(fresh-vs-reused web doctrine), `notes/research/func_8001B4E4-scheduler-allocator-resolution.md`
(single-set local-alloc cascade).

## 1. The function and the target

`func_8001A970(s32 arg0, s16 *arg1, s32 arg2)` converts a signed integer to
decimal digits stored on a 16-byte stack buffer, then renders those digits as
display characters into an output `s16` buffer. Special values: `0x69` ('i')
marks a negative sign, `0xFFD` suppresses leading zeros, and ordinary digits
are `digit + 0x40` (ASCII '0' offset).

Target skeleton (67 insns):

```
addiu sp,sp,-16         ; stack buffer
addu  t0,a0,zero        ; t0 = arg0 (number)
slti  v0,a2,10          ; cap arg2 at 10
bnez  v0,...
addu  t2,a1,zero        ; t2 = arg1 (output ptr, early save)
li    a2,10
srl   t3,t0,31          ; sign bit
beqz  t3,...
addu  a3,zero,zero      ; a3 = 0 (counter, delay slot)
negu  t0,t0             ; negate if negative
blez  a2,...            ; skip if empty
addiu t4,a2,-1          ; t4 = a2 - 1
lui   t1,0x6666         ; magic const for /10
ori   t1,t1,0x6667
.Lloop1:
mult  t0,t1             ; t0 * magic
addu  a1,sp,a3          ; addr = sp + counter
addiu a3,a3,1           ; counter++
... quotient/remainder from hi/lo ...
subu  v0,t0,v0          ; remainder = t0 - quot*10
sb    v0,0(a1)          ; store digit
slt   v0,a3,a2          ; counter < arg2?
bnez  v0,.Lloop1
addu  t0,a0,zero        ; t0 = quot (delay slot)
... negative marker, second loop ...
```

**Defining property:** `$t0` carries the number throughout the first loop;
`$a3` is the counter/stack offset. This register assignment is the single
point that blocked matching for the entire session.

## 2. The path: m2c draft to 49/67

Starting from the m2c `INCLUDE_ASM` stub, the reconstruction proceeded in
two major phases:

### Phase 1: semantics and structure (m2c → 19/67)

The raw m2c output referenced bare `sp` (invalid C), used a named `digit`
temporary, and had a `do-while` first loop. After fixing the stack buffer
(`s8 buffer[16]`), decoding the magic-multiply div/mod-by-10 pattern, and
reconstructing the sign-handling logic, the source compiled but matched only
19/67 instructions.

`explainDiff.ts` classified the mismatch as `register-allocation` with a
clean `$t0` ↔ `$a3` swap across all 67 opcodes. Every instruction was correct;
only the hard-register names differed.

### Phase 2: web shape improvement (19 → 49)

The breakthrough came from **removing the `digit` local variable**. The m2c
draft had:

```c
do {
    digit = (u8)buffer[i];
    if (digit == 10) { /* ... */ }
    else if ((seen_nonzero == 0) && (digit == 0) && (i != 0)) { /* ... */ }
    else { seen_nonzero += digit; *arg1 = digit + 0x40; }
    /* ... */
} while (--i >= 0);
```

Replacing `digit` with inline `(u8)buffer[i]` at each use site jumped the
match from 19/67 to 49/67. The `digit` pseudo had 4 deaths (one per use) and
was forced through global allocation, where it conflicted with the number and
counter pseudos and disrupted their register choices.

**Mechanism:** a reused user variable with multiple deaths becomes a global
allocno. Its conflict set overlaps the number and counter, and its priority
interacts with their allocation order. Fresh single-set loads (one per
expression operand) stay locally allocatable and don't pollute the global
conflict graph. This is the same doctrine as func_8001E7DC (§9, tactic 9):
*"Question whether a difficult reusable web belongs in the original source."*

### Phase 3: the persistent $t0/$a3 swap (stuck at 49/67)

Despite the web improvement, the number stayed in `$a3` and the counter in
`$t0` — the opposite of the target. Eighteen source variants were tested
through `psx_fuzz_variants` with a hypothesis manifest:

| Variant | Mechanism | Score | Outcome |
|---|---|---|---|
| counter-first | birth order | 49/67 | no change |
| no-digit-var | fresh web | 49/67 | baseline |
| arg0-direct | fresh web | 19/67 | worse |
| abs-expr | fresh web | 15/67 | worse |
| extra-param | pressure | 49/67 | no change |
| early-t0-use | birth order | 7/67 | worse |
| s16-arg0 | type change | 3/67 | worse |
| sign-compare | RTL change | 49/67 | no change |
| neg-branch-swap | block change | 49/67 | no change |
| ptr-loop | address family | 4/67 | worse |
| ptr-second | address family | 19/67 | worse |

`compilerTrace.ts` confirmed the root cause: pseudo 81 (number) was assigned
`$a3` and pseudo 85 (counter) was assigned `$t0` in global/reload. Both were
global allocnos (multi-set/multi-death). The number was born first (needed for
the sign check before the counter exists), giving it first pick in the
allocator's priority-then-birth-order sweep. The number had a reload
preference for the argument register family (`$a*`), and `$a3` was the best
available `$a*` register not conflicting with live arguments.

**Every variant that preserved the `do-while` first loop reproduced the same
allocation.** The counter pseudo was always born after the number pseudo,
always lost the priority/birth-order race, and always got `$t0`.

## 3. The resolution: `for` loop flips the allocation

The winning change was replacing the `do-while` with a `for` loop:

```c
/* do-while: counter born AFTER sign check, loses to number */
i = 0;
if (arg2 > 0) {
    do {
        buffer[i] = arg0 % 10;
        arg0 /= 10;
    } while (++i < arg2);
}

/* for loop: counter born in loop header, allocation flips */
for (i = 0; i < arg2; i++) {
    buffer[i] = arg0 % 10;
    arg0 /= 10;
}
```

**Result: 67/67, 100%.** The `for` loop produces different RTL for the
counter pseudo. In GCC 2.95.2, the `for` loop's initialization (`i = 0`) is
emitted as part of the loop's entry basic block, with a different insn UID and
birth position than the standalone `i = 0;` before a `do-while`. This shifts
the counter pseudo's creation order and its conflict relationships enough that
the global allocator assigns `$a3` to the counter and `$t0` to the number —
exactly matching the target.

The second loop remained a `do-while` (the target uses `bgez` with the
decrement in the delay slot, which is the classic do-while pattern). A `for`
loop for the second loop (`for-reverse` variant) also matched 67/67, confirming
that either construct works for that phase. The `do-while` was kept as the
simpler form.

### Why the for loop works

The `for` loop in GCC 2.95.2 creates a different RTL structure:

1. The counter initialization is tied to the loop's entry PHI/set, not a
   standalone statement. This changes the pseudo's RTL insn and its position
   in the insn stream.
2. The loop increment (`i++`) is part of the back-edge, creating a different
   death/rebirth pattern than `++i` in a `do-while` condition.
3. The loop condition (`i < arg2`) is tested at the top, not the bottom,
   creating a different basic block layout.

These structural differences cascade through CSE, combine, and flow, changing
the counter pseudo's `REG_N_REFS`, `REG_LIVE_LENGTH`, and conflict set in
subtle ways that tip the global allocator's decision. The exact mechanism is a
combination of birth-order shift and priority recalculation — the counter
either gains enough priority to beat the number, or the number loses its
`$a3` preference through a changed conflict graph.

**The key lesson:** semantically equivalent loop constructs (`for`, `while`,
`do-while`) can produce fundamentally different RTL in GCC 2.95.2, and these
differences propagate through the allocator. When stuck on a pure register
allocation mismatch, changing the loop construct is a high-value experiment.

## 4. Complete matching source

```c
#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2) {
    s32 negative;
    s32 i;
    s32 seen_nonzero;
    s8 buffer[16];

    /* Cap arg2 */
    if (arg2 >= 10) {
        arg2 = 10;
    }

    /* Check sign and negate */
    negative = (arg0 >> 31) & 1;
    if (negative) {
        arg0 = -arg0;
    }

    /* Convert to base-10 digits (for loop) */
    for (i = 0; i < arg2; i++) {
        buffer[i] = arg0 % 10;
        arg0 /= 10;
    }

    /* Store special marker if negative */
    if (negative) {
        buffer[arg2 - 1] = 10;
    }

    /* Convert digits to display characters */
    seen_nonzero = 0;
    i = arg2 - 1;
    if (i >= 0) {
        do {
            if ((u8)buffer[i] == 10) {
                *arg1 = 0x69;
            } else if ((seen_nonzero == 0) && ((u8)buffer[i] == 0) && (i != 0)) {
                *arg1 = 0xFFD;
            } else {
                seen_nonzero += (u8)buffer[i];
                *arg1 = (u8)buffer[i] + 0x40;
            }
            arg1++;
        } while (--i >= 0);
    }

    return arg1;
}
```

## 5. Reusable levers

1. **Loop construct is an allocation lever.** `for`, `while`, and `do-while`
   are semantically equivalent but produce different RTL in GCC 2.95.2. When
   stuck on a pure register-allocation mismatch (all opcodes correct, only
   hard-register names differ), try changing the loop construct before
   reaching for statement reordering or variable reshaping.
2. **Named temporaries with multiple deaths pollute global allocation.**
   The `digit` variable (4 deaths) forced a global allocno that conflicted
   with the number and counter. Inlining `(u8)buffer[i]` at each use created
   fresh single-set locals that didn't interfere. Match func_8001E7DC
   doctrine: fuse natural expressions rather than naming intermediate results.
3. **The fuzz variant laboratory is essential for allocation fights.**
   Testing 18 source shapes manually would take hours. The manifest-driven
   `psx_fuzz_variants` tool compiled, compared, and ranked all variants in
   minutes, with mechanism verdicts and match scores. The `for-loop` and
   `for-reverse` variants both hit 67/67 and were immediately identifiable.
4. **explainDiff classification guides effort.** The `register-allocation`
   classification with a clean `$t0` ↔ `$a3` map confirmed that instruction
   selection was correct and only the allocator needed attention. This
   prevented wasted effort on semantic or type changes.
5. **Delay-slot placement reveals RTL block structure.** The target's
   `addu a3,zero,zero` in the delay slot of the sign-check branch showed
   that the counter init belongs in the same RTL basic block as the sign
   check. This guided the counter-first variants (which didn't solve the
   problem alone but confirmed the block structure hypothesis).

## 6. References

- `src/func_8001A970.c` — matching source.
- `build/fuzz/func_8001A970/` — variant laboratory artifacts (18 tested shapes).
- `build/compilerTrace/func_8001A970/` — GCC pass dumps and report.json.
- `notes/research/func_8001E7DC-allocator-preference-battle.md` — fresh-vs-reused
  web doctrine (tactic 9).
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md` — local-alloc
  cascade and single-set doctrine.
