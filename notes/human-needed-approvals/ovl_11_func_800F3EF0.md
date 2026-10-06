# ovl_11_func_800F3EF0 — resolved in the parked-function campaign

**Current resolution:** 35/35 byte-exact and fully finalized. The user expressly
permitted source-policy exceptions for these parked functions. This candidate
uses three allowlisted register variables to reproduce pointer allocation and
constant birth order, without a compiler-flag change. They are reconstruction
workarounds, not evidence of original register-variable source. The historical
attempt and its conditional search results below remain archived.
Receipt: build/parked-recovery/800F3EF0-finalize.json.

- **Parked:** 2026-09-15T06:04:38.786Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F3EF0.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 2] at 26/35 words, measured 2026-09-15T04:21:29, first scored from src/overlays/ovl_11/ovl_11_func_800F3EF0.c) rather than the source left on disk, which measured [0, 0, 0, 2] at 28/35 words, measured 2026-09-15T04:22:23

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F3EF0 verdict MISMATCH — 26/35 words (74.3%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 2.
Next block: 2 (0x800F3F10) — population 0, schedule 0, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 0, 2] is 2 term(s) from exact and 11 distinct programs since have not beaten it, across 13 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 11 distinct measurements since the residual last improved on [0, 0, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 11 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

s32 ovl_11_func_800F3EF0(void)
{
    u16 *cnt;
    u16 *pend;
    u16 *src;
    s32 i;

    cnt = D_800711C4;
    if (cnt[0x7E] == 0) {
        return 0;
    }
    pend = cnt + 0x7E;
    src = cnt + 0x7F;
    for (i = 0; i < 25; i++) {
        cnt[i] = cnt[i] + src[i];
        if (cnt[i] >= 1000) {
            cnt[i] = 999;
        }
        src[i] = 0;
    }
    *(s32 *)&cnt[0x1A] += *(s32 *)&pend[0x1A];
    pend[0] = 0;
    *(s32 *)&pend[0x1A] = 0;
    return 1;
}
```
