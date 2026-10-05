# ovl_21_func_800B90C4 — human decision needed

- **Parked:** 2026-10-05T16:08:36.718Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_21/ovl_21_func_800B90C4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 1] at 34/40 words, measured 2026-10-05T15:54:27, first scored from build/ovl_21_func_800B90C4/cand3.c) rather than the source left on disk, which was never measured

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autodecomp.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `configs/flag_overrides.mk:416` — **flag-override** — Per-function compiler flag override is not allowlisted
  `CC1FLAGS_ovl_21_func_800B90C4 := -fno-schedule-insns`
- `configs/flag_overrides.mk:416` — **flag-override** — New per-function compiler flag overrides are forbidden
  `CC1FLAGS_ovl_21_func_800B90C4 := -fno-schedule-insns`

## Oracle report for the preserved attempt

```
Oracle: ovl_21_func_800B90C4 verdict MISMATCH — 33/45 words (73.3%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 1.
2 word(s) are UNDETERMINED — a relocation whose symbol has no known address. Block 4 contains them and is excluded from the residual above: their terms are an artifact of the unresolved relocation, and no source edit moves them. This is a configuration defect, not a source one. The usual cause is a jump table with no `.rodata` attribution in the container's splat config — `npx tsx tools/build/deriveRodataSplits.ts --container <id>` says so, and the build's link rule rederives it. Fix that before rewriting anything.
Next block: 5 (0x800B9154) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 0, 1] is 1 term(s) from exact and 18 distinct programs since have not beaten it, across 7 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 16 distinct measurements since the residual last improved on [0, 0, 0, 0]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 16 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

void ovl_21_func_800BA4C0(void);
s32 ovl_21_func_800B97F4(void);
s32 func_8002261C(s32 arg0, s32 arg1);
void SetVal8005E2BC(s32 arg0);
void SetVal8005E334(s32 arg0);

extern s16 D_800BCCD4[];

void ovl_21_func_800B90C4(void) {
    s32 s1;
    s32 s2;
    u8 *base;

    ovl_21_func_800BA4C0();
    s1 = ovl_21_func_800B97F4();
    if (s1 == -1) {
        func_8002261C(4, 0x26);
        s2 = 0xC;
    } else {
        s2 = 0xB;
        if (s1 == 0) {
            s2 = 0xA;
        }
        SetVal8005E2BC(0);
        SetVal8005E334(0);
        base = (u8 *)D_800C0448;
        func_8002261C(4, D_800BCCD4[*(s16 *)(base + 0x640 + s1 * 2)]);
    }
    base = (u8 *)D_800C0448;
    *(s16 *)(base + 0x988) = 0;
    D_800C0448[0] = s2;
}
```
