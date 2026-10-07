# ovl_17_func_800BA704 — human decision needed

- **Parked:** 2026-10-07T21:35:15.857Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_17/ovl_17_func_800BA704.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 2] at 63/65 words, measured 2026-10-07T21:22:51, first scored from build/ovl_17_func_800BA704_cand25.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_17_func_800BA704 verdict MISMATCH — 63/66 words (95.5%).
Instruction count delta versus target: +1.
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 2.
Next block: 2 (0x800BA72C) — population 0, schedule 0, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 0, 2] is 2 term(s) from exact and 47 distinct programs since have not beaten it, across 61 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 47 distinct measurements since the residual last improved on [0, 0, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 47 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

void ovl_17_func_800BA704(void) {
    s32 temp_v1;
    s32 var_t2;
    u16 *var_t1;
    u16 temp_a0;
    u16 temp_a1;
    u16 temp_v0;
    u16 temp_v1_2;
    u16 var_a1;
    u8 *var_a2;
    u8 *var_t0;
    u8 *var_t3;
    u8 *var_a3;
    u8 *base;
    u8 *work;
    u8 *out;
    u8 *prow;
    u8 *base2;
    s16 cff;
    s32 cneg;

    var_a1 = 2;
    base = (u8 *) &D_8006C838;
    work = base + 0x8000;
    if ((*(s16 *) (work + 0x6514)) != 3) {
        var_a1 = (u16) (*(s16 *) (work + 0x6514));
    }
    var_t3 = D_800BD758;
    temp_v1 = var_a1 * 0x54;
    prow = base + 0xE51E;
    var_t1 = (u16 *) (prow + temp_v1);
    var_a2 = D_800BD848;
    cff = 0xFF;
    cneg = 0xFFFE0000;
    var_t2 = 5;
    var_t0 = D_800BD848 + 0x38;
    var_a3 = work + (temp_v1 + 0x651C);
    do {
        temp_a1 = *var_t1;
        var_t1 += 7;
        temp_v0 = *(u16 *) (var_a3 - 4);
        temp_v1_2 = *(u16 *) (var_a3 - 2);
        temp_a0 = *(u16 *) var_a3;
        var_a3 += 0xE;
        var_t2 -= 1;
        (*(s8 *) ((u8 *) var_a2 + 0x28)) = 0;
        (*(s16 *) ((u8 *) var_a2 + 0x2A)) = cff;
        (*(s16 *) ((u8 *) var_a2 + 0x2C)) = 0;
        (*(s16 *) ((u8 *) var_a2 + 0x2E)) = 0;
        (*(s32 *) ((u8 *) var_t0 + -8)) = 0;
        (*(u16 *) ((u8 *) var_a2 + 0x34)) = temp_v0;
        (*(u16 *) ((u8 *) var_a2 + 0x36)) = temp_v1_2;
        (*(u16 *) ((u8 *) var_a2 + 0x42)) = temp_a0;
        (*(u16 *) ((u8 *) var_a2 + 0x44)) = temp_a1;
        (*(s32 *) ((u8 *) var_t0 + 0)) = cneg;
        (*(u8 **) ((u8 *) var_a2 + 0x3C)) = var_t3;
        var_t3 += 6;
        var_a2 += 0x50;
        var_t0 += 0x50;
    } while (var_t2 >= 0);
    base2 = (u8 *) &D_8006C838;
    if ((*(s16 *) (base2 + 0x8000 + 0x6514)) == 3) {
        out = D_800BD848;
        (*(s8 *) (out + 0xC8)) = 1;
        (*(u16 *) (out + 0xD4)) = (u16) (*(u16 *) (base2 + 0x8000 + 0x1348));
        (*(u16 *) (out + 0xD6)) = (u16) (*(u16 *) (base2 + 0x8000 + 0x12B2));
    }
}
```
