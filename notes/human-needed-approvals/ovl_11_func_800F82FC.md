# ovl_11_func_800F82FC — human decision needed

- **Parked:** 2026-10-07T22:50:48.171Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F82FC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 4, 0, 15] at 40/66 words, measured 2026-10-07T22:32:16, first scored from build/variants/800F82FC/var_i3.c) rather than the source left on disk, which measured [0, 4, 1, 19] at 37/66 words, measured 2026-10-07T22:41:42

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F82FC verdict MISMATCH — 40/66 words (60.6%).
Residual (steer by this, not the word count): control-flow 0, population 4, schedule 0, allocation 15.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 7 (0x800F8390) — population 2, schedule 0, allocation 1. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 52 distinct measurements since the residual last improved on [0, 4, 0, 15]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 52 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"
#include "psyq/libgpu.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} M2C_8573ba8bfae4_CopyStruct_84D4;

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} M2C_3f22cd297a83_CopyStruct_8480;

int DrawSync (int mode);
int LoadImage (RECT *rect, u_long *p);
int MoveImage2 (RECT *rect, int x, int y);
int StoreImage (RECT *rect, u_long *p);
void *memset ();
s32 ovl_11_func_800F8404 (s32 arg0);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void SetVal8005E2BC (s32 arg0);
void SetVal8005E334 (s32 arg0);
s32 ovl_11_func_800D5750 (s16 arg0);
s32 func_800226B0 (void);
void func_80022738 (void);
s32 func_8001FABC (s16 arg0);
void ovl_11_func_800F8224 (s16 *arg0, s16 arg1);
s32 ovl_11_func_800F8188 ();
s32 ovl_11_func_800D5810 (s16 arg0);
s32 ovl_11_func_800D57A4 (s16 arg0);
s8 ovl_11_func_800D583C (s16 arg0);
void ovl_11_func_800F84D4 (M2C_8573ba8bfae4_CopyStruct_84D4 *arg0, M2C_8573ba8bfae4_CopyStruct_84D4 *arg1);
void ovl_11_func_800D5740 (s16 *arg0);
void ovl_11_func_800F8480 (M2C_3f22cd297a83_CopyStruct_8480 *arg0, M2C_3f22cd297a83_CopyStruct_8480 *arg1);
void ovl_11_func_800F8428 (u16 *arg0, u16 *arg1);
s32 ovl_11_func_800D60D4 (s16 *arg0);
s32 func_8002261C (s32 arg0, s32 arg1);
s32 GetVal8005E5B4 (void);
void ovl_11_func_800D666C (s16 arg0);
s32 ovl_11_func_800D6730 (s16 value, s16 row);
s32 ovl_11_func_800D678C (s16 arg0);
s32 ovl_11_func_800D67F4 (s16 arg0);

extern s32 D_80070D42;
extern s32 D_80071042;
extern s32 D_80071A8A;

s32 *ovl_11_func_800F82FC(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 *var_s2;
    s32 *var_v0;
    s32 *var_v0_2;
    s32 *var_v0_3;
    s32 temp_a;
    s32 temp_s0;
    s32 temp_v0;
    s32 var_v1;
    s32 var_v1_2;

    temp_a = (arg1 * 8) - 9;
    temp_s0 = temp_a + arg0;
    if (D_80126E40 == 0) {
        var_s2 = &D_80071A84;
        var_v1 = (arg0 << 1) + arg0;
        var_v1 <<= 1;
        var_v0_2 = (s32 *) ((u8 *) &D_80071A84 + 6);
    } else {
        var_s2 = &D_80071A8A;
        var_v1 = (arg0 << 1) + arg0;
        var_v1 <<= 1;
        var_v0_2 = &D_80071A8A + 0xC;
    }
    var_v0 = (s32 *) ((u8 *) var_v0_2 + var_v1);
    temp_v0 = ovl_11_func_800F8404(arg0);
    switch (temp_v0) {
    case 0:
        return var_s2;
    case 1:
        return var_v0;
    default:
            if (D_80126E40 == 0) {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80070EC2;
            } else if (D_80126E40 != 2) {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80071042;
            } else {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80070D42;
            }
        return (s32 *) ((u8 *) var_v0_3 + var_v1_2);
    }
}
```
