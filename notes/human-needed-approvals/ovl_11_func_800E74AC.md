# ovl_11_func_800E74AC — human decision needed

- **Parked:** 2026-08-24T18:36:18.644Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800E74AC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 4, 2, 0] at 15/18 words, measured 2026-08-24T18:25:55)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800E74AC verdict MISMATCH — 15/22 words (68.2%).
Instruction count delta versus target: -1.
Residual (steer by this, not the word count): control-flow 0, population 4, schedule 2, allocation 0.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 2 (0x800E74DC) — population 1, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 3 distinct measurements since the residual last improved on [0, 4, 2, 0]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

s32 ovl_11_func_800E74AC(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s16 *p = (s16 *)&D_8006C838;
    s16 x = p[0x2964];
    s16 y = p[0x2968];
    s32 dx = x - arg2;
    s32 result;

    if (dx < 0) {
        dx = -dx;
    }
    if (dx < arg0) {
        s32 dy = y - arg3;
        if (dy < 0) {
            dy = -dy;
        }
        result = dy < arg1;
    } else {
        result = 0;
    }
    return result;
}
```
