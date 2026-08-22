# func_8001BFEC — human decision needed

- **Parked:** 2026-08-22 (re-parked; first parked 2026-08-22T08:04:22Z)
- **Reason:** one allocation priority inversion
- **Source:** `src/func_8001BFEC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the best policy-clean program — 47/58 words, `[0, 2, 0, 5]`

## The policy question is closed

The first park was `asm-needs-human-approval`: the function switches `$sp` to
the PlayStation scratchpad around each of its two calls, and the loop had no
tier above it to adjudicate the construct. That is now a **classification**,
not a per-function exception — `sourcePolicy.allowStackPointerSwitch`, on by
default. No C construct moves the stack pointer, so this is the right answer
for the construct rather than a judgement about this function. The reasoning,
the evidence that the developers measured the stack depth, and the derivation
of the macro form they must have written are in
`notes/research/scratchpad-stack-switch.md`.

## What is left

The population term of 2 is **not a defect**. The reversal reports
`[n/a] mach pre-dbr instruction order: the function contains inline assembly,
whose emitted word count is not derivable from the RTL`, and those two words
are that gap. Every instruction is present, with the same operands.

The real residual is one priority inversion among three callee-saved values:

| value | refs | live | priority | candidate | target |
|---|---|---|---|---|---|
| the hoisted `0x1F8003FC` constant | 5 | 15 | 6666 | `$s0` | `$s1` |
| the element offset | 7 | 26 | 5384 | `$s1` | `$s2` |
| the loop counter `i` | 7 | 32 | 4375 | `$s2` | `$s0` |

`psx_allocator_counterfactual` states the requirement exactly: **`i` must reach
priority 6666 — one more reference (8 rather than 7), or a live range of 21
rather than 32.** GCC 2.95's formula is
`trunc((floor(log2(refs)) * refs / live) * 10000)`, verified against
`global.c` and the `.greg` header.

So the open question is what the original source did that gave the loop counter
either an eighth reference or a live range eleven insns shorter.

### Ruled out

| direction | verdict |
|---|---|
| the spelling of the stack-switch assembly | **closed** — one combined template, four separate statements (the form that makes `func_8001C0D4` byte-exact), and dropping the `$sp` clobber all compile to the identical program |
| a `for` loop with the increment in the header | **closed** — 47/55, population 8 |
| deriving the element offset from `i` (`+ i * 0x1C`) | **closed** — identical; GCC strength-reduces it straight back to a running offset |
| a walking element pointer instead of an offset | **closed** — 42/57 |
| one `slot` variable shared across both switch sites | **closed** — 42/55 |
| register pinning | **rejected** — the pre-classification attempt reached 53/58 by pinning `i`, `r_off` and `slot` to `$s0`/`$s2`/`$s1`, which is the answer written down rather than derived, and remains forbidden |

## Policy findings

- none: the stack switch is classified, and the preserved attempt uses nothing
  else

## Oracle report for the preserved attempt

```
Match: 47/58 words
Residual: control-flow 0, population 2 (artifact), schedule 0, allocation 5.
```

## Preserved attempt

```c
#include "common.h"
#include "scratchpad.h"

s32 D_8005E2D4;
void *D_8005E4D8;

void func_8001BFEC(void **arg0) {
    s32 i;
    s32 r_off;
    unsigned int *slot;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        SP_TO_SCRATCH(SCRATCHPAD_SP_SLOT);
        func_8001D6B8();
        SP_FROM_SCRATCH();
    }
    if (*(s32 *)((char *)D_8005E4D8 + 8) > 0) {
        i = 0;
        slot = SCRATCHPAD_SP_SLOT;
        r_off = 0xC;
        do {
            SP_TO_SCRATCH(slot);
            func_8001C37C((char *)D_8005E4D8 + 0xC, (char *)D_8005E4D8 + r_off);
            SP_FROM_SCRATCH();
            r_off += 0x1C;
        } while (++i < *(s32 *)((char *)D_8005E4D8 + 8));
    }
    PopMatrix();
}
```
