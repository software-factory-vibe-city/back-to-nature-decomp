# ovl_11_func_800F0E00 — human decision needed

- **Parked:** 2026-10-09T12:00:55.060Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F0E00.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 1, 0, 5] at 70/84 words, measured 2026-10-09T10:34:11, first scored from build/cand_800F0E00/c32.c) rather than the source left on disk, which measured [0, 1, 0, 5] at 70/84 words, measured 2026-10-09T10:36:25

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autoloop.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `configs/flag_overrides.mk:515` — **flag-override** — Per-function compiler flag override is not allowlisted
  `CC1FLAGS_ovl_11_func_800F0E00 := -fno-strength-reduce`
- `configs/flag_overrides.mk:515` — **flag-override** — New per-function compiler flag overrides are forbidden
  `CC1FLAGS_ovl_11_func_800F0E00 := -fno-strength-reduce`

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F0E00 verdict MISMATCH — 70/84 words (83.3%).
Residual (steer by this, not the word count): control-flow 0, population 1, schedule 0, allocation 5.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 11 (0x800F0F0C) — population 1, schedule 0, allocation 1. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 49 distinct measurements since the residual last improved on [0, 1, 0, 5]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 49 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

extern u16 D_8006F5F0;
extern s32 D_80129618;
extern s32 D_8012961C;

void *memcpy(void *dest, const void *src, u32 n);
void *memset(void *s, int c, u32 n);

void ovl_11_func_800F0E00(void *arg0) {
    u16 *list;
    u16 term;
    s32 count;

    D_80129618 = 0;
    if (arg0 == 0) {
        D_80129618 = 0;
    } else {
        list = &D_8006F5F0;
        memset(list, 0, 0xE10);
        memcpy(list, arg0, 0xE10);
        term = 0xFFFF;
        count = 0;
        if (*list == term) {
            D_80129618 = 0;
        } else {
            do {
                count += 1;
            } while (*((u16 *)((u8 *)list + count * 0x24)) != term);
            D_80129618 = count;
        }
    }
    D_8012961C = 0;
}
```
