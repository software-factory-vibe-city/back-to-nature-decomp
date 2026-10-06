# ovl_11_func_800EF870 — resolved

**Resolved:** clean C is byte-exact (19/19) and fully finalized, without
assembly or flag overrides. Independently indexed member-array stores
produce the two base copies that precomputed-pointer variants could not.
The old impossibility findings were conditional on the wrong address
expression family. Historical evidence below is retained; see the parked
techniques ledger.

- **Parked:** 2026-08-24T11:56:05.548Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800EF870.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 7] at 6/17 words, measured 2026-08-24T11:25:28, first scored from src/overlays/ovl_11/ovl_11_func_800EF870.c) rather than the source left on disk, which measured [0, 0, 4, 7] at 6/13 words, measured 2026-08-24T11:55:43

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800EF870 verdict MISMATCH — 6/19 words (31.6%).
Instruction count delta versus target: -2.
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 7.
Next block: 0 (0x800EF870) — population 0, schedule 1, allocation 7. smallest open residual

This block's residual shape `li <reg>,0x8000@-1` is not new.
It was closed in ovl_11_func_800D6090, which carried it at [0, 4, 1, 2] (12/16 words). The edit that closed it:

  ...
   * clear). Index is masked to 16 bits before the *40 stride multiply. */
  s32 ovl_11_func_800D6090(u16 arg0) {
-     ItemData *item = &D_8006C858[arg0];
+     s8 type = D_8006C858[arg0].type;
  
-     if ((item->u0.flags & 0x8100) != 0x8000)
+     if ((D_8006C858[arg0].u0.flags & 0x8100) != 0x8000)
          return 0;
-     return (s8)item->type != 1;
+     return type != 1;
  }
  

That is a proven answer for this shape in this codebase. Try it before modelling the compiler.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 11 distinct measurements since the residual last improved on [0, 0, 1, 7]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 11 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

void ovl_11_func_800EF870(s16 arg0) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0xC;
    p += 0x8000;
    *(s16 *)(p + 0x64D8) = -1;
    *(s16 *)(p + 0x64DA) = 0;
    *(s16 *)(p + 0x64DC) = 0;
    *(s16 *)(p + 0x64E0) = -1;
    *(s16 *)(p + 0x64E2) = -1;
}
```
