# ovl_11_func_800D812C — resolved

The preserved scheduling residual was solved with clean C: compute both
products before storing the first, then assign the branch-specific constant.
The live implementation is byte-exact (36/36 words) and passed full finalization.
See `notes/techniques-for-solving-parked-functions.md` for measured experiments.
The historical park record follows.

- **Parked:** 2026-09-15T08:02:09.016Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D812C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 2, 0] at 34/34 words, measured 2026-09-15T06:24:12)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D812C verdict MISMATCH — 34/36 words (94.4%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 2, allocation 0.
Next block: 1 (0x800D8144) — population 0, schedule 1, allocation 0. same residual shape as block 2 — one source fix should close all of them
Fixing it should also close block 2.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 2, 0] is 2 term(s) from exact and 8 distinct programs since have not beaten it, across 12 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 8 distinct measurements since the residual last improved on [0, 0, 2, 0]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 8 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    /* 0x0 */ s32 unk0;
    /* 0x4 */ char pad_4[0x4];
    /* 0x8 */ s32 unk8;
} Recon800D812CA2View;

s32 ovl_11_func_800D812C(s16 arg0, s16 arg1, Recon800D812CA2View *arg2, s16 arg3) {
    s32 ret;

    if (arg3 == 0) {
        arg2->unk0 = arg0 * 400 - 0x1068;
        ret = 0x578 - arg1 * 400;
    } else {
        arg2->unk0 = arg0 * 400 - 0x58C;
        ret = 0x3FC - arg1 * 400;
    }
    arg2->unk8 = ret;
    return ret;
}
```
