# ovl_11_func_800F227C — human decision needed

- **Parked:** 2026-09-16T12:27:56.663Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F227C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 2, 0] at 49/52 words, measured 2026-09-16T12:04:06)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F227C verdict MISMATCH — 49/54 words (90.7%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 2, allocation 0.
Next block: 2 (0x800F229C) — population 0, schedule 2, allocation 0. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 3 distinct measurements since the residual last improved on [0, 0, 2, 0]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

void ovl_11_func_800F227C(s16 arg0) {
    struct_80076220 *rec;
    struct_80076220_entry *en;
    u8 *b1;
    u16 *b2;
    u16 *b3;
    s16 temp;
    s32 i;
    s32 j;

    if (arg0 != 0x168) {
        rec = &D_80076220;
        for (j = 0; j < 37; j++) {
            en = rec->unkE4;
            for (i = 0; i < 30; i++) {
                temp = en[i].unk0;
                if (temp < arg0) {
                    continue;
                }
                if (arg0 < temp) {
                    rec->unk22 = (i < 0) ? 0 : i;
                } else {
                    rec->unk22 = i;
                }
                rec->unkC = 0;
                b1 = (u8 *)rec + 0xE6;
                rec->unkE = b1[(u32)rec->unk22 * 8];
                b2 = (u16 *)((u8 *)rec + 0xE8);
                rec->unk2C = b2[(u32)rec->unk22 * 4];
                b3 = (u16 *)((u8 *)rec + 0xEA);
                rec->unk2E = b3[(u32)rec->unk22 * 4];
                break;
            }
            rec++;
        }
    }
}
```
