# ovl_11_func_800FC8C8 — human decision needed

- **Parked:** 2026-10-06T16:26:50.400Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800FC8C8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 3, 2] at 46/50 words, measured 2026-10-06T16:18:11)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800FC8C8 verdict MISMATCH — 46/52 words (88.5%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 3, allocation 2.
Next block: 0 (0x800FC8C8) — population 0, schedule 3, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 4 distinct measurements since the residual last improved on [0, 0, 3, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FC8C8(void) {
    Ovl11D80127328Entry *var_s0;
    u8 *base;
    s32 var_s6;
    s32 temp_v1;
    s32 var_a1;
    s32 var_s1;
    u32 var_s2;

    var_s2 = 0;
    var_a1 = 0x8C;
    var_s6 = 0xC0;
    base = (u8 *) &D_8006C838;
    var_s0 = D_80127328;
    var_s1 = 0xA40000;
    do {
        if ((*(s32 *) (base + 0x44F8)) & var_s0->unk0) {
            func_80015EE8(D_8005E3C0->field_D8 + 0x68, (s32) D_8012CE88, (s32) var_s0->unk4, 0, (s16) var_a1, (s16) var_s6);
            temp_v1 = var_s1 >> 0x10;
            var_s1 += 0x180000;
            var_a1 = temp_v1;
        }
        var_s2 += 1;
        var_s0 += 1;
    } while (var_s2 < 6U);
}
```
