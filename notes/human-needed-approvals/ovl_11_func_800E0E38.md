# ovl_11_func_800E0E38 — human decision needed

- **Parked:** 2026-10-09T13:37:17.550Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800E0E38.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 0, 2] at 73/85 words, measured 2026-10-09T13:19:58)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800E0E38 verdict MISMATCH — 73/85 words (85.9%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 2.
Next block: 0 (0x800E0E38) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

VALLEY: the best key [0, 0, 0, 2] is 2 term(s) from exact and 13 distinct programs since have not beaten it, across 27 distinct keys clustered around it. That is a floor, not a gradient. A best this close that a whole sweep cannot improve on means the remaining distance is several coordinates wide: every single-coordinate respelling moves one of the other coordinates the wrong way, scores worse, and reads as a refutation of the direction it tried. Sweeping one axis at a time cannot cross it however long it runs. Take the next experiment from the REQUIREMENT side instead of from another spelling:   psx_target_loop_emission  — what the original's loop pass must have emitted, and by which route   psx_triage                — its cluster-donor finding names a sibling that already reaches a                               mechanism this program does not, with the trace that measured it   psx_analyze_target_schedule / psx_allocator_counterfactual — the same for the later passes Write the program the requirement describes, in one edit, and measure that. STALLED: 13 distinct measurements since the residual last improved on [0, 0, 0, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed with psx_record_closed, and read that record before you run one — a direction another session already closed costs minutes to close again. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 13 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"
#include "psyq/libgpu.h"
#include "psyq/libapi.h"
#include "psyq/memory.h"

typedef struct {
    s16 field_00;
    u16 field_02;
} M2C_ab2039654fca_Group;

typedef struct {
    s16 field_00;
    s16 field_02;
    s16 field_04;
    s16 field_06;
} M2C_ab2039654fca_Vertex;

typedef struct {
    u16 field_00;
    u16 field_02;
    u16 field_04;
    u16 field_06;
    u16 field_08;
    u16 field_0A;
    s16 field_0C;
    s16 field_0E;
    s16 field_10;
    s16 field_12;
    u32 pad_14;
    u32 pad_18;
    M2C_ab2039654fca_Vertex *field_1C;
    M2C_ab2039654fca_Group *field_20;
    u8 *field_24;
    M2C_ab2039654fca_Group *field_28;
    u8 *field_2C;
    s32 field_30;
} M2C_ab2039654fca_SourceData;

typedef struct {
               s16 unk0;
               s16 unk2;
} M2C_729a6ccf4038_UnkStruct80107DE0;

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
} M2C_a5df3a0a31de_UnkStruct800DF4F0;

typedef struct {
               char pad_00[0x26];
               s16 unk26;
               s16 unk28;
               s16 unk2A;
               s16 unk2C;
               char pad_2E[0x34 - 0x2E];
               s32 unk34;
               char pad_38[0xB6 - 0x38];
               s16 unkB6;
} M2C_8d3156bb36aa_Struct_800DF010;

typedef struct {
               u16 unk0;
} M2C_1023b6857e0a_UnkStruct800E109C;

typedef struct {
               s16 unk0;
               s16 unk2;
} M2C_b289ac4b613d_UnkStruct80107DE0;

typedef struct {
               char pad_00[0x16];
               s16 unk16;
               char pad_18[0xA8 - 0x18];
               M2C_b289ac4b613d_UnkStruct80107DE0 unkA8;
} M2C_b289ac4b613d_Struct_800D049C;

typedef struct {
               u16 unk0;
               char pad_02[0x24];
               s16 unk26;
               char pad_28[0xC];
               s32 unk34;
               char pad_38[0x76];
               u16 unkAE;
} M2C_bd4797768b62_Struct_800E2AF0;

int CdControl (u_char com, u_char *param, u_char *result);
void CdFlush (void);
CdlLOC *CdIntToPos (int i, CdlLOC *p);
int CdRead (int sectors, u_long *buf, int mode);
void CdReadBreak (void);
int CdReadSync (int mode, u_char *result);
int CdSync (int mode, u_char *result);
int FntPrint ();
int MoveImage (RECT *rect, int x, int y);
void SystemError (char, long);
int VSync (int mode);
void *memset ();
s32 ovl_11_func_800E0AFC (Recon_ovl_11_func_800E0AFC_A0View *arg0);
void func_80015704 ();
void func_80015868 (Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
s32 func_800129E8 (void);
void func_80015880 (SpriteSourceData *src, s32 header, s32 field_18);
s32 func_80011F5C (s32 arg0);
void func_80011FD8 (s32 arg0);
POLY_FT4 *func_800165D8 (u_long *arg0, POLY_FT4 *arg1, M2C_ab2039654fca_SourceData *arg2, u8 arg3, u8 arg4, s16 arg5, s16 arg6, s32 arg7, s32 arg8, s32 arg9, u16 arg10, s16 arg11, s16 arg12, s16 arg13, s16 arg14);
void func_80017300 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);
s32 ovl_11_func_800C2884 (s16 key, u32 *table);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001B2CC (s32 arg0, s32 arg1);
u32 func_8001589C (SpriteSourceData *src);
void ovl_11_func_800CCFF8 (Recon_ovl_11_func_800CCFF8_A0View *arg0, s32 arg1, u8 arg2, s32 arg3);
void ovl_11_func_800C6E0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6E8C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F6C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800D7328 (s16 *arg0);
void ovl_11_func_800D7348 (u16 *dst, u16 *src);
void ovl_11_func_800BD8DC (s16 arg0);
void func_80015894 (SomeStruct *arg0, s32 arg1);
s32 ovl_11_func_8010C330 (s32 arg0);
void ovl_11_func_800D2D54 (void *arg0);
void ovl_11_func_800CF748 (void);
void ovl_11_func_800CF848 (void);
s32 ovl_11_func_800D2E20 (void);
u32 Rand (s32 arg0);
u16 *ovl_11_func_800CE744 (s32 arg0, s32 arg1);
s32 ovl_11_func_800F5888 (u16 *arg0, s32 *arg1);
s32 ovl_11_func_800D2950 (s32 arg0);
void func_80016054 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, s16 arg5, s16 arg6, s32 arg7, s32 arg8, u16 arg9);
s32 func_8001DFD4 (s32 *arg0, SVECTOR *arg1);
s32 ovl_11_func_800D037C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_800158E4 (SpriteSourceData *src);
s32 func_80015DD4 (s32 *arg0, SpriteSourceData *arg1, s32 arg2, s32 arg3, s32 arg4, s32 arg5, s32 arg6, s32 arg7, s32 arg8);
void ovl_11_func_800C9E90 (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_80107DE0 (M2C_729a6ccf4038_UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);
void ovl_11_func_800E0450 (s32 arg0);
s32 ovl_11_func_80107DEC (M2C_42071334137b_Ov11Timer *arg0);
void ovl_11_func_800DE878 (s32 arg0);
void ovl_11_func_80107DD0 (s16 *arg0);
s32 ovl_11_func_800E276C (s16 *arg0);
void ovl_11_func_800E1F70 (s32 arg0);
void ovl_11_func_800D2F1C (s32 arg0);
s32 ovl_11_func_800C1224 (s16 arg0, s16 arg1);
void ovl_11_func_800D266C (M2C_d59586abe320_Ov11D266CFields *arg0, u16 *arg1, s32 arg2);
void ovl_11_func_80108CA4 (s32 arg0);
void ovl_11_func_8010B198 (s32 arg0);
void ovl_11_func_800D05D0 (Ovl11SetFieldsView *arg0, Ovl11PaddedVec3 v);
s32 ovl_11_func_800D3424 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
void func_8001585C (ObjectState *obj, s8 arg1);
void SetVal8005E43C (s32 arg0);
void ovl_11_func_800D03B4 (M2C_057dca34f681_Struct_800D03B4 *arg0, M2C_057dca34f681_Struct_800D03B4 *arg1, s32 arg2);
s32 ovl_11_func_800D3468 (u16 *arg0);
s32 ovl_11_func_800D3C04 (void *arg0);
s32 ovl_11_func_800D3CA4 (void *arg0);
s32 ovl_11_func_800D3C54 (void *arg0);
s32 ovl_11_func_800D3CE8 (void *arg0);
s32 ovl_11_func_800D3104 (u16 *arg0, s32 arg1);
s32 ovl_11_func_800D5750 (s16 arg0);
s32 ovl_11_func_800D6730 (s16 value, s16 row);
s32 ovl_11_func_800D688C (s16 arg0);
void func_80014BCC (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
s32 ovl_11_func_800D678C (s16 arg0);
s32 ovl_11_func_800D67F4 (s16 arg0);
void ovl_11_func_800D6944 (SpriteSourceData *arg0, u16 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s16 arg6);
void func_80017200 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
s32 ovl_11_func_800DF3BC (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800DF4F0 (M2C_a5df3a0a31de_UnkStruct800DF4F0 *arg0);
s32 ovl_11_func_800D0408 (s16 arg0, Recon800D0408A1View *arg1, s32 arg2);
s32 ovl_11_func_800DEEE0 (Recon_ovl_11_func_800DEEE0_A0View *arg0);
s32 ovl_11_func_800DF010 (M2C_8d3156bb36aa_Struct_800DF010 *arg0, s32 arg1);
s32 ovl_11_func_800E0F8C (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800E109C (M2C_1023b6857e0a_UnkStruct800E109C *arg0);
s32 ovl_11_func_800E0FD0 (Recon_ovl_11_func_8010CE80_A0View *arg0);
void ovl_11_func_800D7338 (s16 *arg0, s16 arg1, s16 arg2, s16 arg3);
void ovl_11_func_800D049C (M2C_b289ac4b613d_Struct_800D049C *arg0);
void ovl_11_func_800D12A0 (s16 arg0);
s32 ovl_11_func_800E2AAC (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_800E2A30 (s16 *arg0);
s32 ovl_11_func_800E2AF0 (M2C_bd4797768b62_Struct_800E2AF0 *arg0);
s32 ovl_11_func_800F5868 (s32 arg0, s32 arg1);
u16 func_80015A18 (SpriteSourceData *arg0, s32 arg1);
void func_80015EE8 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
s32 ovl_11_func_80109550 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_801098B0 (Ovl11Func801098B0Arg *arg0);
s32 ovl_11_func_8010B898 (u16 arg0, u16 arg1, u16 *arg2, u16 *arg3);
s32 ovl_11_func_8010B57C (u16 *arg0, s32 arg1);

extern u32 D_8008F7F8;
extern s32 *D_80124FCC;

s16 ovl_11_func_800E0E38(Recon_ovl_11_func_800E0AFC_A0View *arg0) {
    Recon_ovl_11_func_800E0AFC_A0View *temp_s0;
    s32 temp_v0;
    s32 var_a2;

    temp_v0 = ovl_11_func_800E0AFC(arg0);
    var_a2 = 5;
    switch (temp_v0) {                              /* switch 1; irregular */
    case 0x164:                                     /* switch 1 */
        (*(s16 *) ((u8 *) arg0 + 0)) = (s16) temp_v0;
        break;
    case 0x165:                                     /* switch 1 */
        (*(s16 *) ((u8 *) arg0 + 0)) = (s16) temp_v0;
        var_a2 = 6;
        break;
    }
    (*(s32 *) ((u8 *) arg0 + 0x34)) = (s32) ((*(s32 *) ((u8 *) arg0 + 0x34)) & 0xFBFFFFFF);
    if ((*(u16 *) ((u8 *) arg0 + 0xB2)) != 0) {
        var_a2 = 8;
    }
    temp_s0 = (SpriteSourceData *)((u8 *)arg0 + 0x78);
    if ((u16) (*(u16 *) ((u8 *) arg0 + 0xB4)) < 7U) {
        var_a2 = 9;
    }
    func_80015704((SpriteSourceData *) temp_s0, (SpriteDataHeader *) ((u8 *) &D_8008F7F8 + D_80124FCC[var_a2]));
    if ((*(u16 *) ((u8 *) arg0 + 0xAE)) != 0) {
        switch (temp_v0) {                          /* switch 2; irregular */
        case 0x164:                                 /* switch 2 */
            func_80015868((Struct_800154CC *) temp_s0, 0, 0, 0, 3);
            break;
        case 0x165:                                 /* switch 2 */
            func_80015868((Struct_800154CC *) temp_s0, 0, 0, 0, 2);
            break;
        }
        if ((*(u16 *) ((u8 *) arg0 + 0xB2)) != 0) {
            func_80015868((Struct_800154CC *) temp_s0, 0, 0, 0x20, 0);
        }
    }
    return 0;
}
```
