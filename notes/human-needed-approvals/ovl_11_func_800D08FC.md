# ovl_11_func_800D08FC — human decision needed

- **Parked:** 2026-10-07T13:29:45.367Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D08FC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 6, 3, 15] at 18/53 words, measured 2026-10-07T13:16:11, first scored from build/experiments/ovl_11_func_800D08FC/variants/c2.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D08FC verdict MISMATCH — 18/57 words (31.6%).
Instruction count delta versus target: -3.
Residual (steer by this, not the word count): control-flow 0, population 6, schedule 3, allocation 15.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 2 (0x800D0930) — population 1, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 20 distinct measurements since the residual last improved on [0, 6, 3, 15]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 20 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

typedef struct {
    s16 unk0;
    s16 unk2;
} Unk800D0DB0;

Unk800D0DB0 *ovl_11_func_800D08FC(s32 arg0) {
    Unk800D0DB0 *ret;
    s16 *ptr;
    s16 *arr;
    s32 i;
    u8 *base;

    ret = 0;
    if (arg0 == 1) {
        arr = D_80076200;
        base = (u8 *)D_8006C838;
        for (i = 0, ptr = arr; i < 2; i++) {
            if (i == 1 && *(u16 *)(base + 0x44D0) == 0) {
                break;
            }
            if (*ptr == -1) {
                ret = (Unk800D0DB0 *)((u8 *)arr + i * 4);
                break;
            }
        }
    } else {
        base = (u8 *)D_8006C838;
        for (i = 2, ptr = (s16 *)(base + 0x99D0); i < 4; i++) {
            if (i == 3 && *(u16 *)(base + 0x44D2) == 0) {
                break;
            }
            if (*ptr == -1) {
                ret = (Unk800D0DB0 *)((u8 *)D_80076200 + i * 4);
                break;
            }
        }
    }
    return ret;
}
```
