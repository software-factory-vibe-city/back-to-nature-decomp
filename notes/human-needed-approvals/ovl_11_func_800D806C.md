# ovl_11_func_800D806C — human decision needed

- **Parked:** 2026-09-16T05:25:59.853Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D806C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 1, 1, 4] at 37/48 words, measured 2026-09-16T03:59:44, first scored from src/overlays/ovl_11/ovl_11_func_800D806C.c) rather than the source left on disk, which measured [0, 3, 0, 3] at 41/48 words, measured 2026-09-16T05:19:48

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D806C verdict MISMATCH — 37/48 words (77.1%).
Residual (steer by this, not the word count): control-flow 0, population 1, schedule 1, allocation 4.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 8 (0x800D8124) — population 1, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 10 distinct measurements since the residual last improved on [0, 1, 1, 4]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 10 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

s32 ovl_11_func_800D806C(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    struct_80123E04 *temp_a3;
    char *far_base;
    s32 *temp_a1;
    s32 var_v0;

    temp_a3 = &D_80123E04 + arg3;
    if ((arg0 < 0) || (arg0 >= temp_a3->unk0)) {
        return 1;
    }
    if ((arg1 < 0) || (arg1 >= temp_a3->unk2)) {
        return 1;
    }
    far_base = (char *) &D_8007AFF0;
    temp_a1 = *(s32 **) (far_base + 0x23608 + ((arg1 * 45) + arg0) * 4);
    if ((arg2 == 0) || (var_v0 = 1, ((*temp_a1 & 8) != 0))) {
        var_v0 = 0;
    }
    return var_v0;
}
```
