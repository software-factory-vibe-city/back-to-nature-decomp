# ovl_11_func_800DDC64 — resolved

A natural for-loop, early index/pointer births and a reused masked flag produce
45/45 byte-exact words. Full finalization passed without any policy exception
or flag change. See `notes/techniques-for-solving-parked-functions.md`.
The historical escalation report below is retained as an archive.

- **Parked:** 2026-09-16T02:46:47.424Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800DDC64.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([1, 34, 0, 5] at 21/41 words, measured 2026-09-16T01:48:45, first scored from src/overlays/ovl_11/ovl_11_func_800DDC64.c) rather than the source left on disk, which measured [1, 34, 2, 4] at 20/41 words, measured 2026-09-16T02:32:54

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800DDC64 verdict MISMATCH — 21/45 words (46.7%).
Instruction count delta versus target: -4.
Residual (steer by this, not the word count): control-flow 1, population 34, schedule 0, allocation 5.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 1 (0x800DDC90) — population 5, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 5 distinct measurements since the residual last improved on [1, 34, 0, 5]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x28];
    /* 0x28 */ u16 unk28;
    /* 0x2A */ u8 pad2[6];
} Ovl11FuncDDC64Entry;

extern Ovl11FuncDDC64Entry D_80128E08[];
extern u32 D_801291A8[2];

void ovl_11_func_800DDC64(void) {
    Ovl11FuncDDC64Entry *p;
    u32 *ptr;
    s32 i;
    u16 f;

    i = 0;
    p = &D_80128E08[0];
    ptr = &D_801291A8[0];
    D_801291A8[0] = 0;
    ptr[1] = 0;
    if (p->unk28 & 0x10) {
        D_801291A8[p->unk28 & 1] = (u32)p;
        if (p->unk28 & 1) {
            goto end;
        }
    }
    while (1) {
        i++;
        if (i >= 0xF) {
            break;
        }
        p++;
        f = p->unk28;
        if (!(f & 0x10)) {
            continue;
        }
        ptr[f & 1] = (u32)p;
        if (!(f & 1)) {
            continue;
        }
        break;
    }
end:
    ((Ovl11FuncDDC64Entry *)D_801291A8[0])->unk28 &= 0xEFFF;
    ((Ovl11FuncDDC64Entry *)D_801291A8[1])->unk28 |= 0x1000;
}
```
