# ovl_11_func_8010BC54 — resolved

Resolved by verified transfer from 800E1770: 37/37 byte-exact words and all
finalization gates passed. Uses the same independently audited padded vector
interface and one selector register binding under the user's explicit policy
exception authorization. The scoped allowlist records that workaround, not a
claim about original source. See the techniques ledger. Historical report follows.

- **Parked:** 2026-10-05T08:03:19.026Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_8010BC54.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 1] at 35/37 words, measured 2026-10-05T07:33:43, first scored from build/candidate_8010BC54.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_8010BC54 verdict MISMATCH — 35/37 words (94.6%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 1.
Next block: 0 (0x8010BC54) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 0, 1] is 1 term(s) from exact and 26 distinct programs since have not beaten it, across 21 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 26 distinct measurements since the residual last improved on [0, 0, 0, 1]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 26 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

typedef struct {
    char pad_00[0x34];
    s32 field_34;
    char pad_38[0x58 - 0x38];
    s32 field_58;
    s32 field_5C;
    s32 field_60;
} Ov11SetFields;

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ov11E1770Vec;

s32 ovl_11_func_800D0408(u16 arg0, Recon800D0408A1View *arg1, s32 arg2);
void ovl_11_func_800D05D0(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

s32 ovl_11_func_8010BC54(Ov11SetFields *arg0) {
    Ov11E1770Vec sp18;
    u8 *base;

    base = (u8 *) D_8006C838;
    ovl_11_func_800D0408(*(u16 *) (base + 0x5200), (Recon800D0408A1View *) &sp18, 0x320);
    sp18.unk0 = sp18.unk0 + *(s32 *) ((u8 *) arg0 + 0x38);
    sp18.unk4 = sp18.unk4 + *(s32 *) ((u8 *) arg0 + 0x3C);
    sp18.unk8 = sp18.unk8 + *(s32 *) ((u8 *) arg0 + 0x40);
    ovl_11_func_800D05D0((s32) arg0, sp18.unk0, sp18.unk4, sp18.unk8, sp18.unkC);
    *(u16 *) ((u8 *) arg0 + 0x22) = *(u16 *) (base + 0x5200);
    return 0;
}
```
