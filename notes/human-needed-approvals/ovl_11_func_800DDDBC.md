# ovl_11_func_800DDDBC — human decision needed

- **Parked:** 2026-08-24T09:27:45.884Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800DDDBC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 2] at 14/16 words, measured 2026-08-24T09:03:57, first scored from src/overlays/ovl_11/ovl_11_func_800DDDBC.c) rather than the source left on disk, which measured [0, 0, 0, 2] at 14/16 words, measured 2026-08-24T09:18:40

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800DDDBC verdict MISMATCH — 14/17 words (82.4%).
Instruction count delta versus target: +1.
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 2.
Next block: 0 (0x800DDDBC) — population 0, schedule 0, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 7 distinct measurements since the residual last improved on [0, 0, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

/* D_8006C838 is a large shared state buffer. At 0x49C4 it holds an array
 * of 8-byte (two s32 word) entries, also touched as plain s32s at 0x49C4 /
 * 0x49C8 by ovl_11_func_800F2354 etc. This shifts entries 0..2 up one slot
 * and clears slot 0, then returns 1. The copy runs high-to-low (memmove
 * order) so the in-place shift is safe. */
s32 ovl_11_func_800DDDBC(void) {
    s32 *base;
    s32 *tail;
    s32 *a;
    s32 c;

    c = 2;
    base = (s32 *)&D_8006C838;
    a = base + 6;
    do {
        a[0x126F + 2] = a[0x126F];
        a[0x126F + 3] = a[0x126F + 1];
        c--;
        a -= 2;
    } while (c >= 0);

    tail = (s32 *)&D_8006C838;
    tail[0x1271] = 0;
    tail[0x1272] = 0;
    return 1;
}
```
