# ovl_11_func_800E3A3C — human decision needed

- **Parked:** 2026-08-24T18:00:38.121Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800E3A3C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 0, 4] at 16/22 words, measured 2026-08-24T17:52:15)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800E3A3C verdict MISMATCH — 16/22 words (72.7%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 4.
Next block: 0 (0x800E3A3C) — population 0, schedule 0, allocation 4. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 6 distinct measurements since the residual last improved on [0, 0, 0, 4]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

extern void (*D_800B9920[])(void);

void ovl_11_func_800E3A3C(void) {
    char *base;
    s32 idx;
    void (**pp)(void);

    base = (char *)&D_8006C838;
    *(s32 *)(base + 0x522C) = 0;
    *(s32 *)(base + 0x5230) = 0;
    idx = *(s32 *)(base + 0x7A74);
    pp = &D_800B9920[idx];
    (*pp)();
    *(s32 *)(base + 0x4450) &= ~0x20;
}
```
