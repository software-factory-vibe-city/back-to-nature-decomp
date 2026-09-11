# ovl_11_func_8010C4D4 — human decision needed

- **Parked:** 2026-09-11T08:17:30.740Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_8010C4D4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([1, 42, 0, 2] at 15/28 words, measured 2026-09-11T08:01:11, first scored from build/try/v18.c) rather than the source left on disk, which measured [1, 44, 0, 0] at 23/25 words, measured 2026-09-11T07:29:32

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_8010C4D4 verdict MISMATCH — 15/32 words (46.9%).
Instruction count delta versus target: +1.
Residual (steer by this, not the word count): control-flow 1, population 42, schedule 0, allocation 2.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 1 (0x8010C4E8) — population 2, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 3 distinct measurements since the residual last improved on [1, 42, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

extern Cell4 D_80075854[];

s32 ovl_11_func_8010C4D4(void) {
    s32 i;
    Cell4 *arr;
    s32 j;

    for (i = 0; i < 3; i++) {
        s32 searchVal;

        if (i == 1) {
            searchVal = 0xA2;
        } else if (i >= 2) {
            searchVal = 0xA3;
        } else if (i == 0) {
            searchVal = 0xA1;
        }
        arr = D_80075854;
        for (j = 0; j < 99; j++) {
            if (arr->field_0 == searchVal) {
                arr->field_0 = 0;
                return searchVal;
            }
            arr++;
        }
    }
    return 0;
}
```
