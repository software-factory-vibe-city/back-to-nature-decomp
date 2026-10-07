# ovl_11_func_800D3D60 — human decision needed

- **Parked:** 2026-10-07T12:37:44.943Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D3D60.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 7] at 40/55 words, measured 2026-10-07T12:30:25, first scored from src/overlays/ovl_11/ovl_11_func_800D3D60.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D3D60 verdict MISMATCH — 40/56 words (71.4%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 7.
Next block: 2 (0x800D3D98) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 10 distinct measurements since the residual last improved on [0, 0, 1, 7]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 10 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "psyq/memory.h"

s32 func_80012A34(s32 arg0);

s32 ovl_11_func_800D3D60(u16 arg0) {
    u8 buf[20];
    s32 count;
    s32 i;
    s32 limit;
    u8 *p;
    s32 one;
    s32 mask;

    memset(buf, 0xFF, 20);
    one = 1;
    count = 0;
    limit = 10;
    if (arg0 == 0) {
        limit = 20;
    }
    for (i = 0; i < limit; i++) {
        mask = 0x20400;
        if (arg0 == 0) {
            p = (u8 *)&D_800749F4 + i * 0xB8;
        } else {
            p = (u8 *)&D_800749F4 - 0x708 + i * 0xB4;
        }
        if (!(*(u32 *)(p + 0x34) & mask) && *(s16 *)(p + 0x30) == one && *(u16 *)p != 0) {
            buf[count] = i;
            count++;
        }
    }
    if (count == 0) {
        return -1;
    }
    return buf[func_80012A34(count & 0xFFFF)];
}
```
