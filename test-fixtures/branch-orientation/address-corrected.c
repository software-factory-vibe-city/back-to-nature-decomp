#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"
#include "psyq/libgpu.h"
#include "psyq/memory.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} M2C_2bc7a43223fd_CoordTri;

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} M2C_4c1a205b3b09_ReconA0View;

typedef struct {
               s16 unk0;
               s16 unk2;
} M2C_f90dacf3c1c7_Ovl11ObjHead;

typedef struct {
               s32 unk0;
               s32 unk4;
               s32 unk8;
} M2C_f90dacf3c1c7_Ovl11Pos;

typedef struct {
               M2C_f90dacf3c1c7_Ovl11Pos *unk0;
               M2C_f90dacf3c1c7_Ovl11ObjHead *unk4;
               u8 pad8[0xC];
               s32 unk14;
} M2C_f90dacf3c1c7_Ovl11CheckArg;

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
               s32 field_00;
               s32 field_04;
               s32 field_08;
} M2C_2667c0b769b3_BoundsArgs4994;

typedef struct {
               s32 field_00;
               s32 field_04;
               s32 field_08;
} M2C_4df042861e66_BoundsArgs4994;

typedef struct {
               s16 field_00;
               char pad_02[0x08 - 0x02];
               s32 field_08;
               s32 field_0C;
               s32 field_10;
} M2C_4df042861e66_BoundsEntry4994;

typedef struct {
    u8 b[4];
} M2C_1d1631a2972a_Ov11_F43CCArgBlk;

typedef struct {
    char pad_00[0x24];
    s16 unk24;
    s16 unk26;
    s16 unk28;
    s16 unk2A;
    s16 unk2C;
    char pad_2E[0x06];
    s32 unk34;
} M2C_708e65b63435_Ovl11D04D4Obj;

typedef struct {
               s16 unk0;
               s16 unk2;
               u16 unk4;
               s16 pad6;
               s32 unk8;
               s32 unkC;
               s32 unk10;
} M2C_701317280b4c_Ov11_4360struct;

typedef struct {
    u16 field_0;
    u16 field_2;
} M2C_e88a4985b4f4_Cell4;

int CdControl (u_char com, u_char *param, u_char *result);
void CdFlush (void);
CdlLOC *CdIntToPos (int i, CdlLOC *p);
int CdRead (int sectors, u_long *buf, int mode);
void CdReadBreak (void);
int CdReadSync (int mode, u_char *result);
int CdSync (int mode, u_char *result);
int FntPrint ();
int MoveImage (RECT *rect, int x, int y);
void OuterProduct0 (VECTOR *v0, VECTOR *v1, VECTOR *v2);
int VSync (int mode);
void *memset ();
s32 func_800129E8 (void);
void func_80015880 (SpriteSourceData *src, s32 header, s32 field_18);
void func_80017300 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);
s32 func_8001E78C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 func_8001E38C (void);
s32 func_8001E7DC (s32 *arg0, s32 *arg1);
s32 func_8001E878 (M2C_2bc7a43223fd_CoordTri *p0, M2C_2bc7a43223fd_CoordTri *p1, M2C_2bc7a43223fd_CoordTri *p2);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void SetVal8005E2E8 (s32 arg0);
s32 ovl_11_func_800C1224 (s16 arg0, s16 arg1);
s32 ovl_11_func_800F4240 (M2C_4c1a205b3b09_ReconA0View *arg0);
s32 ovl_11_func_800D7504 (s16 arg0);
s32 ovl_11_func_800BE5A0 (M2C_f90dacf3c1c7_Ovl11CheckArg *arg0);
s32 GetVal8005E524 (void);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001B2CC (s32 arg0, s32 arg1);
u32 func_8001589C (SpriteSourceData *src);
void ovl_11_func_800CCFF8 (Recon_ovl_11_func_800CCFF8_A0View *arg0, s32 arg1, u8 arg2, s32 arg3);
void ovl_11_func_800C6E0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6E8C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F6C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void *ovl_11_func_800BDE84 (u8 *arg0, s16 *arg1);
s32 func_8001FABC (s16 arg0);
s32 ovl_11_func_800DF010 (M2C_8d3156bb36aa_Struct_800DF010 *arg0, s32 arg1);
s32 ovl_11_func_8010B57C (u16 *arg0, s32 arg1);
void ovl_11_func_800D7328 (s16 *arg0);
void ovl_11_func_800D7348 (u16 *dst, u16 *src);
void ovl_11_func_800CE034 (M2C_ad72053e5aa9_StructOvl11CE034A *arg0, M2C_ad72053e5aa9_StructOvl11CE034B *arg1, s32 arg2);
void ovl_11_func_800D666C (s16 arg0);
s32 ovl_11_func_800BF3F4 (void);
void func_80015704 (SpriteSourceData *out, SpriteDataHeader *header, s32 arg2, s32 arg3);
s32 ovl_11_func_8010C330 (s32 arg0);
s32 func_8002261C (s32 arg0, s32 arg1);
void ovl_11_func_8010C4B0 (void);
void func_8001AF70 (u16 arg0, u16 arg1);
s32 ovl_11_func_800C79F8 (M2C_2667c0b769b3_BoundsArgs4994 *arg0);
void ovl_11_func_800F0FB0 (s32 arg0);
s32 ovl_11_func_800CE514 (s16 arg0);
s16 ovl_11_func_800CE528 (s16 arg0);
M2C_4df042861e66_BoundsEntry4994 *ovl_11_func_800F4994 (M2C_4df042861e66_BoundsArgs4994 *arg0);
s32 ovl_11_func_800F3E44 (s16 arg0);
s32 ovl_11_func_800BF3D0 (void);
s32 ovl_11_func_800F3BCC (u16 arg0);
void ovl_11_func_800F43CC (s32 arg0, M2C_1d1631a2972a_Ov11_F43CCArgBlk arg1, M2C_1d1631a2972a_Ov11_F43CCArgBlk arg2, M2C_1d1631a2972a_Ov11_F43CCArgBlk arg3, M2C_1d1631a2972a_Ov11_F43CCArgBlk arg4, u16 arg5, s32 arg6);
s32 ovl_11_func_80109188 (M2C_708e65b63435_Ovl11D04D4Obj *arg0, s32 arg1);
void ovl_11_func_800C3CCC (void);
void ovl_11_func_800BD8DC (s16 arg0);
void func_80015894 (SomeStruct *arg0, s32 arg1);
void SetVal8005E51C (s32 arg0);
s32 ovl_11_func_800D3104 (u16 *arg0, s32 arg1);
s32 ovl_11_func_800CF258 (s32 arg0);
void ovl_11_func_800D3200 (s32 arg0);
s32 ovl_11_func_800D0408 (s16 arg0, Recon800D0408A1View *arg1, s32 arg2);
s32 ovl_11_func_800D5750 (s16 arg0);
s32 ovl_11_func_800D6730 (s16 value, s16 row);
s32 ovl_11_func_800D688C (s16 arg0);
void func_80014BCC (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
s32 ovl_11_func_800D678C (s16 arg0);
s32 ovl_11_func_800D67F4 (s16 arg0);
void ovl_11_func_800D6944 (SpriteSourceData *arg0, u16 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s16 arg6);
void func_80017200 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
s32 ovl_11_func_800D5C3C (s16 arg0);
Ovl11D124Entry *ovl_11_func_800DAF60 (s32 arg0, s16 arg1, s16 arg2);
s32 ovl_11_func_800D5C90 (s16 arg0);
s32 func_8001AF44 (u32 arg0);
s32 ovl_11_func_800C0A28 (void);
s32 ovl_11_func_800D603C (s32 arg0);
s32 ovl_11_func_800F3C9C (u16 arg0);
s32 ovl_11_func_800F581C (void);
void ovl_11_func_800F4360 (M2C_701317280b4c_Ov11_4360struct *arg0, s16 arg1, s16 arg2, Vec3 vec);
void ovl_11_func_8010C550 (M2C_e88a4985b4f4_Cell4 *arg0, s32 arg1);
s32 ovl_11_func_8010C668 (void);

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ovl11_8011E090_Arg0Copy;

s32 ovl_11_func_8011E090(s32 *arg0, u16 *arg1, u16 *arg2, void *arg3) {
    Ovl11_8011E090_Arg0Copy tmp;
    u8 *base;
    u8 *p;
    u8 *tbl;
    s32 idx;
    s16 temp_a1;
    s16 temp_a3;
    s16 temp_a0;
    s16 temp_v1;
    s32 *ptr;

    tmp = *(Ovl11_8011E090_Arg0Copy *)arg0;
    *arg1 = *(u16 *)arg0 + 0x654;
    *arg2 = 0x4C4 - *(u16 *)((u8 *)arg0 + 8);
    temp_a0 = (s16)*arg2;
    temp_a1 = (s16)*arg1;
    *arg1 = (s16)*arg1 / 400;
    *arg2 = (s16)*arg2 / 400;
    if (temp_a1 < 0) {
        *arg1 -= 1;
        return 2;
    }
    temp_a3 = (s16)*arg1;
    if (temp_a3 >= 7) {
        return 3;
    }
    if (temp_a0 < 0) {
        *arg2 -= 1;
        return 2;
    }
    temp_v1 = (s16)*arg2;
    if (temp_v1 >= 7) {
        return 3;
    }
    base = (u8 *)&D_8007AFF0;
    idx = (temp_v1 * 0x2D + temp_a3) * 4;
    p = base + 0x20000;
    tbl = p + 0x3608;
    ptr = *(s32 **)(tbl + idx);
    if (*(s16 *)(p + 0x5476) != 6 || (*ptr & 8) != 0) {
        return 0;
    }
    return 1;
}
