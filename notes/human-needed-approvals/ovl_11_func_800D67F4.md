# ovl_11_func_800D67F4 — resolved in the parked-function campaign

**Current resolution:** 38/38 byte-exact and fully finalized. The user explicitly
permitted source-policy exceptions. Two allowlisted register variables fix the
base/wanted-value allocation and birth order; writing the reset address
index-first preserves the original final addu operand order. These bindings
are reconstruction workarounds, not evidence of original pinned source.
No compiler flag changed. Historical attempts remain below.
Receipt: build/parked-recovery/800D67F4-finalize.json.

- **Parked:** 2026-09-15T16:46:51.533Z
- **Reason:** escalation-exhausted
- **Escalation reached:** glm-5-3-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D67F4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 2] at 30/38 words, measured 2026-09-15T15:32:48, first scored from build/variants/800D67F4/v8_val_first.c) rather than the source left on disk, which measured [0, 0, 1, 0] at 37/37 words, measured 2026-09-15T15:46:49

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D67F4 verdict MISMATCH — 30/38 words (78.9%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 2.
Next block: 0 (0x800D67F4) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 6 distinct measurements since the residual last improved on [0, 0, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    s16 unk00;
    char unk[0x16];
    s16 unk18;
    char pad[4];
} Ovl11A04B8Entry;

extern Ovl11A04B8Entry D_800A04B8[1][9];

s32 ovl_11_func_800D67F4(s16 arg0) {
    Ovl11A04B8Entry *p;
    s32 result;
    s32 offset;
    u32 i;
    u32 j;
    u32 val;

    i = 0;
    offset = arg0 * 0x10E;
    p = (Ovl11A04B8Entry *)((char *)D_800A04B8 + offset);
    do {
        val = i * 8;
        result = 1;
        j = 0;
        do {
            if (val == p->unk00) {
                if (p->unk18 < 0x3F0) {
                    result = 0;
                }
            }
            j++;
            p++;
        } while (j < 9);
        if (result == 0) {
            i++;
            p = (Ovl11A04B8Entry *)((char *)D_800A04B8 + offset);
            continue;
        }
        return i;
    } while (i < 8);
    return 0;
}
```
