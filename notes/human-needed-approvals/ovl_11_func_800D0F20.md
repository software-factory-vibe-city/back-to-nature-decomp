# ovl_11_func_800D0F20 — human decision needed

- **Parked:** 2026-10-07T07:13:59.748Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D0F20.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 2] at 31/37 words, measured 2026-10-07T07:09:09, first scored from build/cand_800D0F20_v60.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D0F20 verdict MISMATCH — 31/37 words (83.8%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 2.
Next block: 3 (0x800D0F64) — population 0, schedule 1, allocation 2. smallest open residual

This block's residual shape `li <reg>,0x8000@-1` is not new.
It was closed in ovl_11_func_800BFE3C, which carried it at [0, 1, 1, 0] (25/25 words). The edit that closed it:

  ...
  
  s32 ovl_11_func_800C0834(s16 arg0);
- s32 ovl_11_func_800C0010(s32 arg0, s32 arg1);
+ void ovl_11_func_800C0010(s32 arg0, s32 arg1);
  
  void ovl_11_func_800BFE3C(void) {
  ...
      s1 = ovl_11_func_800C0834(*(s16 *)(base + 0x44C0));
      ovl_11_func_800C0010(1, (s32)&D_80128A80[s1 * 3]);
-     *(s32 *)(base + 0x6768) = s1;
      base += 0x8000;
      *(s32 *)(base + 0x6768) = s1;

That is a proven answer for this shape in this codebase. Try it before modelling the compiler.
Also closed in ovl_11_func_800D6090, ovl_11_func_800EF870.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 1, 2] is 3 term(s) from exact and 8 distinct programs since have not beaten it, across 31 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 8 distinct measurements since the residual last improved on [0, 0, 1, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 8 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0F20(s32 arg0, s32 arg1) {
    s16 *slot;
    s32 *p;
    s32 idx;
    s16 val;

    idx = arg0 + 2;
    if (ovl_11_func_800D0BC8(idx) != 0) {
        return 0x1E6;
    }
    p = ovl_11_func_800D0CD8();
    if (p != 0) {
        *(s32 *)((u8 *)p + 0x34) |= 0x02000000;
        val = ovl_11_func_800E2934(p);
        slot = (s16 *)D_8006C838;
        slot = (s16 *)((u8 *)slot + idx * 4);
        slot[0x4CE4] = val;
        slot = slot + 1;
        slot[0x4CE4] = arg1;
        return 0;
    }
    return 0x1A1;
}
```
