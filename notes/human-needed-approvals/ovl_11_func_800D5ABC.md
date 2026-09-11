# ovl_11_func_800D5ABC — human decision needed

- **Parked:** 2026-09-11T16:13:37.311Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D5ABC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 14] at 16/28 words, measured 2026-09-11T16:06:14, first scored from src/overlays/ovl_11/ovl_11_func_800D5ABC.c) rather than the source left on disk, which measured [0, 0, 2, 3] at 28/31 words, measured 2026-09-11T16:11:59

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D5ABC verdict MISMATCH — 16/32 words (50%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 14.
Next block: 0 (0x800D5ABC) — population 0, schedule 0, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 3 distinct measurements since the residual last improved on [0, 0, 0, 14]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ void *field_24;
} D8006C838FuncLookup;

s32 ovl_11_func_800D5ABC(void *arg0) {
    D8006C838FuncLookup *v = (D8006C838FuncLookup *)&D_8006C838;
    s16 temp_a0;
    s32 t;
    char *base2;

    temp_a0 = *(s16 *)((char *)v->field_20 + (*(s16 *)arg0 * 0x28) + 0x0E);
    if (temp_a0 == -1) {
        return -1;
    }
    base2 = (char *)v->field_24;
    t = (s16)(temp_a0 * 5);
    t += (u16)*(u16 *)(arg0 + 2);
    t = (s16)t;
    base2 += t * 0xB0;
    return *(u16 *)(base2 + 0xAA);
}
```
