# ovl_11_func_800DACD4 — human decision needed

- **Parked:** 2026-10-07T10:53:07.273Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800DACD4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 3, 4] at 49/54 words, measured 2026-10-07T10:35:25, first scored from build/preparation/ovl_11_func_800DACD4/3020df544fe6edd41aff8ab3fb8eb8553fb323ccf672113b47d36ea6a8234720/draft.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800DACD4 verdict MISMATCH — 49/55 words (89.1%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 3, allocation 4.
Next block: 3 (0x800DAD50) — population 0, schedule 3, allocation 4. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 12 distinct measurements since the residual last improved on [0, 0, 3, 4]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 12 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libcd.h"
#include "psyq/libsnd.h"
#include "psyq/libapi.h"

typedef struct {
               char pad0[0x36];
               u16 flags;
               char pad38[0x40 - 0x38];
               u16 vals[(0x84 - 0x40) / 2];
               s16 value;
} M2C_583b0b68ff5a_UnkStruct800CD5BC;

typedef struct {
               char pad0[0x38];
               u16 unk38;
               char pad3A[0x100 - 0x3A];
                s32 unk100;
                s32 unk104;
                s32 unk108;
} M2C_ad72053e5aa9_StructOvl11CE034A;

typedef struct {
               s32 unk0;
               s32 unk4;
               s32 unk8;
} M2C_ad72053e5aa9_StructOvl11CE034B;

typedef struct {
               s16 field_0;
               s16 field_2;
} M2C_42071334137b_Ov11Timer;

typedef struct {
    char pad_00[0x26];
    s16 field_26;
    char pad_28[0x34 - 0x28];
    s32 field_34;
} M2C_d59586abe320_Ov11D266CFields;

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} M2C_057dca34f681_Struct_800D03B4;

typedef struct {
               u16 unk0;
               u16 unk2;
               u8 unk4;
               u8 unk5;
               u16 unk6;
} M2C_abf795ba7347_UnkStruct800DA390;

typedef struct {
               u16 unk0;
} M2C_a5df3a0a31de_UnkStruct800DF4F0;

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} M2C_4c1a205b3b09_ReconA0View;

typedef struct {
    u16 field_0;
    u16 field_2;
} M2C_e88a4985b4f4_Cell4;

int CdControlB (u_char com, u_char *param, u_char *result);
void CdFlush (void);
int CdPosToInt (CdlLOC *p);
void SsSetSerialVol (char, short, short);
void SystemError (char, long);
Ovl11D124Entry *ovl_11_func_800DAF60 (s32 arg0, s16 arg1, s16 arg2);
s32 ovl_11_func_800D5C90 (s16 arg0);
s32 func_8001AF44 (u32 arg0);
void func_80021B20 ();
void ovl_11_func_800CD5BC (M2C_583b0b68ff5a_UnkStruct800CD5BC *arg0, s32 arg1);
s32 ovl_11_func_800C9D64 (void);
void ovl_11_func_800CE034 (M2C_ad72053e5aa9_StructOvl11CE034A *arg0, M2C_ad72053e5aa9_StructOvl11CE034B *arg1, s32 arg2);
s32 ovl_11_func_8010C330 (s32 arg0);
void ovl_11_func_800D2D54 (void *arg0);
s32 func_80021B64 (void);
void func_80021B90 (s32 arg0);
u32 Rand (s32 arg0);
s32 ovl_11_func_800F5888 ();
s32 ovl_11_func_800D2950 (s32 arg0);
void func_80016054 ();
s32 func_8001DFD4 (s32 *arg0, SVECTOR *arg1);
s32 ovl_11_func_800D037C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_800158E4 (SpriteSourceData *src);
void ovl_11_func_800E0450 (s32 arg0);
s32 ovl_11_func_80107DEC (M2C_42071334137b_Ov11Timer *arg0);
void ovl_11_func_800DE878 (s32 arg0);
void ovl_11_func_80107DD0 (s16 *arg0);
void ovl_11_func_800E1F70 (s32 arg0);
void ovl_11_func_800D2F1C (s32 arg0);
s32 ovl_11_func_800C1224 (s16 arg0, s16 arg1);
void ovl_11_func_800D266C (M2C_d59586abe320_Ov11D266CFields *arg0, u16 *arg1, s32 arg2);
void ovl_11_func_80108CA4 (s32 arg0);
void ovl_11_func_8010B198 (s32 arg0);
void ovl_11_func_800D05D0 (Ovl11SetFieldsView *arg0, Ovl11PaddedVec3 v);
s32 ovl_11_func_800CBDFC (void);
s32 ovl_11_func_8010B57C (u16 *arg0, s32 arg1);
s32 ovl_11_func_800D3424 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001585C (ObjectState *obj, s8 arg1);
void SetVal8005E43C (s32 arg0);
void ovl_11_func_800D03B4 (M2C_057dca34f681_Struct_800D03B4 *arg0, M2C_057dca34f681_Struct_800D03B4 *arg1, s32 arg2);
s32 ovl_11_func_800D3C04 (void *arg0);
s32 ovl_11_func_800D3CA4 (void *arg0);
s32 ovl_11_func_800D3C54 (void *arg0);
s32 ovl_11_func_800D3CE8 (void *arg0);
void func_80015704 ();
s32 ovl_11_func_800D5868 (s16 arg0);
s32 ovl_11_func_800D5F44 (u16 a, u16 b);
s32 ovl_11_func_800D812C (s16 arg0, s16 arg1, Vec3 *arg2, s16 arg3);
s32 ovl_11_func_800D5D38 (u16 a, u16 b);
void ovl_11_func_800F397C (u16 arg0, u16 arg1);
s32 ovl_11_func_800D5D9C (u16 a, u16 b);
s32 ovl_11_func_800D5E64 (u16 a, u16 b);
s32 ovl_11_func_800D5ED4 (u16 a, u16 b);
void ovl_11_func_800DA390 (M2C_abf795ba7347_UnkStruct800DA390 *arg0);
s32 ovl_11_func_800D5E00 (u16 a, u16 b);
void ovl_11_func_800F3898 (u16 arg0, u16 arg1);
s32 ovl_11_func_800D5C3C (s16 arg0);
s32 ovl_11_func_800DF3BC (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800DF4F0 (M2C_a5df3a0a31de_UnkStruct800DF4F0 *arg0);
s32 ovl_11_func_800E0F8C (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800E0AFC ();
void func_80015868 (Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
s32 ovl_11_func_800E2AAC (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800E2A30 (s16 *arg0);
s32 ovl_11_func_800E2718 (void *arg0);
s32 ovl_11_func_800C0A28 (void);
s32 ovl_11_func_800F581C (void);
s32 ovl_11_func_800F4240 (M2C_4c1a205b3b09_ReconA0View *arg0);
void ovl_11_func_800F0FB0 (s32 arg0);
s32 ovl_11_func_80109550 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_8010B898 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
void ovl_11_func_8010C550 (M2C_e88a4985b4f4_Cell4 *arg0, s32 arg1);
s32 ovl_11_func_8010C668 (void);
s32 ovl_11_func_800D61D8 (s16 arg0);

s32 ovl_11_func_800D759C(s16 arg0, s16 arg1, s16 arg2, s32); /* static */
s32 ovl_11_func_8011E1E8(s16 arg0, s16 arg1, s16 arg2, s32); /* static */
extern void (*D_80123DFC[])(s16, s16, s16);

void ovl_11_func_800DACD4(s16 arg0, s16 arg1, s32 arg2) {
    Ovl11D124Entry *temp_v0;
    u16 temp_v1;
    s32 temp_v0_2;
    s16 temp_a2;

    temp_v0 = ovl_11_func_800DAF60(arg2, arg1, arg0);
    if (temp_v0 != NULL) {
        if ((u16) temp_v0->unk0 == 0x36) {
            temp_v0_2 = ovl_11_func_800D5C90((s16) temp_v0->unk0);
            temp_v0->unk4 = temp_v0_2;
            temp_v0->unk5 = 0;
            temp_v1 = (u16) temp_v0->unk6 | 0x8000;
            temp_v0->unk6 = temp_v1;
            if (temp_v0_2 & 0xFF) {
                temp_a2 = (s16) ((((temp_v0->unk4 - 1) * 8) | 5) + (temp_v1 & 0xF));
                D_80123DFC[arg2](arg1, arg0, temp_a2);
            }
        }
    }
}
/* Warning: callback table D_80123DFC: incomplete contracts; open original target set: ovl_11:D_80123DFC: index range and table immutability not proven; examined ovl_11_func_800D759C, ovl_11_func_8011E1E8 */
```
