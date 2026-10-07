# ovl_31_func_800B83B8 — human decision needed

- **Parked:** 2026-10-07T10:13:42.062Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_31/ovl_31_func_800B83B8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 1, 0, 1] at 50/53 words, measured 2026-10-07T10:04:23, first scored from src/overlays/ovl_31/ovl_31_func_800B83B8.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_31_func_800B83B8 verdict MISMATCH — 45/54 words (83.3%).
Instruction count delta versus target: -1.
Residual (steer by this, not the word count): control-flow 0, population 4, schedule 0, allocation 2.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 8 (0x800B8464) — population 2, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 1, 0, 1] is 2 term(s) from exact, and the nearest of the other 9 distinct key(s) measured is 6 — 12 distinct programs, and nothing landed in between. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 7 distinct measurements since the residual last improved on [0, 1, 0, 1]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libmcrd.h"
#include "psyq/stdio.h"


long MemCardGetDirentry (long chan, char *name, struct DIRENTRY *dir, long *files, long ofs, long max);
long MemCardSync (long mode, long *cmds, long *rslt);
int sprintf (char *buffer, const char *fmt, ...);

s32 ovl_31_func_800B83B8(void) {
    s32 sp18;
    s32 sp1C;
    s32 *var_a2;
    s32 temp_v0;
    s32 temp_v1;
    s32 var_a0;
    s32 var_a3;
    s32 var_v1;
    s32 temp_v2;

    MemCardSync(0, &sp18, &sp1C);
    MemCardGetDirentry(0, D_800B7EF0, &D_800B88B0, (s32 *) D_800B8868, 0, 0xF);
    var_a3 = 0;
    if ((*(s32 *) ((u8 *) D_800B8868 + 0)) > 0) {
        var_a2 = &D_800B88B0.size;
        var_a0 = *(s32 *) ((u8 *) D_800B8868 + 0);
        do {
            temp_v0 = *var_a2;
            var_v1 = temp_v0;
            if (temp_v0 < 0) {
                var_v1 = temp_v0 + 0x1FFF;
            }
            temp_v1 = var_v1 >> 0xD;
            if (temp_v0 & 0x1FFF) {
                temp_v2 = var_a3 + 1;
                var_a3 = temp_v2 + temp_v1;
            } else {
                var_a3 += temp_v1;
            }
            var_a0 -= 1;
            var_a2 += 0xA;
        } while (var_a0 != 0);
    }
    sprintf(D_800B8B10, D_800B7EF4, *(s32 *) ((u8 *) D_800B8868 + 0), var_a3);
    return 2;
}
```
