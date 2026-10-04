# ovl_17_func_800B90F8 — human decision needed

- **Parked:** 2026-10-04T08:33:39.490Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_17/ovl_17_func_800B90F8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 7] at 9/24 words, measured 2026-10-04T08:21:57, first scored from build/scratch/ovl_17_func_800B90F8/bb2.c) rather than the source left on disk, which measured [0, 0, 2, 5] at 15/22 words, measured 2026-10-04T08:16:35

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_17_func_800B90F8 verdict MISMATCH — 9/25 words (36%).
Instruction count delta versus target: +1.
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 7.
Next block: 3 (0x800B912C) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 28 distinct measurements since the residual last improved on [0, 0, 0, 7]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 28 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

void ovl_17_func_800B90F8(void) {
    u8 *base;
    s32 i;
    s32 val;
    s32 x;
    s32 word;
    s32 minus1;

    i = 0;
    word = -0x20000;
    minus1 = -1;
    x = 0x10000;
    val = 0x4D;
    base = D_800BD848;
    do {
        *(s32 *)(base + 0x2D8) = word;
        *(s16 *)(base + 0x2DC) = minus1;
        if (i < 6) {
            *(s16 *)(base + 0x2DC) = val;
        }
        i = x;
        x += 0x10000;
        val += 0x1A;
        i >>= 16;
        base += 8;
    } while (i < 90);
    base = D_800BD848;
    *(s16 *)(base + 0x5A8) = 6;
}
```
