# ovl_11_func_800BD3C4 — human decision needed

- **Parked:** 2026-10-06T06:08:56.441Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800BD3C4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 1, 4] at 40/48 words, measured 2026-10-06T05:56:04)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800BD3C4 verdict MISMATCH — 40/50 words (80%).
Instruction count delta versus target: +1.
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 4.
Next block: 0 (0x800BD3C4) — population 0, schedule 1, allocation 4. smallest open residual

This block's residual shape `addu <reg>,<reg>,<reg>@3` is not new.
ovl_11_func_800D5D38 carried it too and has not closed it. Whatever answers it here answers it there; record what you find.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 11 distinct measurements since the residual last improved on [0, 0, 1, 4]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 11 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C(u8 *arg0);

extern s32 D_801227B0[];
extern s32 *D_80124FCC[];
extern s32 D_8008F7F8;

void ovl_11_func_800BD3C4(s32 arg0) {
    s32 *p;
    s32 *q;
    s32 n;
    char *base;

    void *t;
    void *save;
    p = &D_801227B0[arg0];
    func_80014BCC(0, p[0], p[1] - p[0], 0, D_8005E3B0 + 0x4290);
    t = (char *)&D_8007AFF0;
    save = (char *)t + 0x20000;
    t = D_80124FCC[arg0];
    *(s32 *)((char *)save + 0x5478) = arg0;
    n = *(s32 *)t;
    n = *(s32 *)((u8 *)t + (n << 2) + 4);
    memcpy(&D_8008F7F8, (void *)(D_8005E3B0 + 0x4290), n);
    func_8001719C((u8 *)((n + 0x4290) + D_8005E3B0));
}
```
