#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"
#include "psyq/memory.h"

typedef struct {
    s16 unk0;
    s16 unk2;
    s16 unk4;
    s16 unk6;
    s16 unk8;
    s16 unkA;
} M2C_a34e94965883_M2C_800EEFB8_Arg1;

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
} M2C_d453384c461b_UnkStruct800D0DBC;

int CdControl (u_char com, u_char *param, u_char *result);
void CdFlush (void);
CdlLOC *CdIntToPos (int i, CdlLOC *p);
int CdRead (int sectors, u_long *buf, int mode);
void CdReadBreak (void);
int CdReadSync (int mode, u_char *result);
int CdSync (int mode, u_char *result);
u_long *ClearOTagR (u_long *ot, int n);
int DrawSync (int mode);
int VSync (int mode);
void *memcpy ();
void *memmove (unsigned char *, const unsigned char *, int);
void *memset ();
void func_8001AF70 (u16 arg0, u16 arg1);
void ovl_11_func_800EEFB8 (s16 arg0, M2C_a34e94965883_M2C_800EEFB8_Arg1 *arg1);
void ovl_11_func_800EF870 (s16 arg0);
void func_80017300 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);
u32 Rand (s32 arg0);
s32 func_80022014 (s32 arg0, s16 arg1);
void func_80014BCC (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C (u8 *arg0);
void SetVal8005E2E8 (s32 arg0);
s32 func_8001E38C (void);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001B2CC (s32 arg0, s32 arg1);
u32 func_8001589C (SpriteSourceData *src);
void ovl_11_func_800CCFF8 (Recon_ovl_11_func_800CCFF8_A0View *arg0, s32 arg1, u8 arg2, s32 arg3);
void ovl_11_func_800C6E0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6E8C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F0C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800C6F6C (Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1);
void ovl_11_func_800CE034 (M2C_ad72053e5aa9_StructOvl11CE034A *arg0, M2C_ad72053e5aa9_StructOvl11CE034B *arg1, s32 arg2);
void ovl_11_func_800D666C (s16 arg0);
void ovl_11_func_800D7328 (s16 *arg0);
void ovl_11_func_800BD8DC (s16 arg0);
void func_80015704 (SpriteSourceData *out, SpriteDataHeader *header, s32 arg2, s32 arg3);
void func_80015894 (SomeStruct *arg0, s32 arg1);
s32 ovl_11_func_80109188 (M2C_708e65b63435_Ovl11D04D4Obj *arg0, s32 arg1);
s32 ovl_11_func_800D3104 (u16 *arg0, s32 arg1);
s32 ovl_11_func_800CF258 (s32 arg0);
void ovl_11_func_800D3200 (s32 arg0);
s32 ovl_11_func_800D2E20 (void);
void ovl_11_func_800DF0F8 (s32 arg0);
void ovl_11_func_800E2904 (s32 arg0);
void ovl_11_func_800D075C (s32 arg0, s16 arg1, s32 arg2);
s32 ovl_11_func_800D0408 (s16 arg0, Recon800D0408A1View *arg1, s32 arg2);
s32 ovl_11_func_800D5750 (s16 arg0);
s32 ovl_11_func_80118C6C (void);
s32 func_8001AF44 (u32 arg0);
s32 ovl_11_func_800DBEF8 (void);
s32 ovl_11_func_800DBE30 (s32 arg0);
void func_8001585C (ObjectState *obj, s8 arg1);
void ovl_11_func_800F4AC0 (s32 arg0);
s32 ovl_11_func_800F4B14 (void);
s32 ovl_11_func_800EFA1C (s16 arg0);
void ovl_11_func_801129A0 (void);
void ovl_11_func_80103830 (void);
s32 ovl_11_func_801037DC (void);
s32 ovl_11_func_801165C8 (void);
s32 ovl_11_func_80103770 (void);
void ovl_11_func_800F0358 (void);
s32 ovl_11_func_800F0474 (s16 arg0);
s32 ovl_11_func_800CFB20 (s32 arg0, s32 arg1);
u16 ovl_11_func_80112160 (s32 arg0);
s32 ovl_11_func_80118C7C (s16 arg0, s16 arg1, s16 arg2);
void func_800121D4 (void);
s32 ovl_11_func_800E9104 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800EFDA0 (s32 arg0, s32 arg1, s32 arg2);
s32 ovl_11_func_800EFE34 (s32 *ptr, s32 arg1, s32 arg2);
s32 pow_int (s32 arg0, s32 arg1);
s32 ovl_11_func_800EF8BC (s16 arg0, s16 arg1, s16 arg2);
s32 ovl_11_func_800C1280 (s16 arg0, s16 arg1);
void ovl_11_func_80112904 (s16 arg0);
s32 func_800231E8 (void);
void func_80023170 (u16 *arg0);
void ovl_11_func_800D0DBC (M2C_d453384c461b_UnkStruct800D0DBC *arg0);
void ovl_11_func_800D079C (s32 arg0);
s32 ovl_11_func_800C0A28 (void);
s32 ovl_11_func_800F14D8 (s32 arg0, s32 arg1, s32 arg2);
s32 ovl_11_func_800F144C (u16 arg0, u16 arg1, s16 *arg2);
s32 ovl_11_func_800F15B4 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
s32 ovl_11_func_800F1744 (u8 arg0, u16 arg1, s32 arg2);
s32 ovl_11_func_800F1878 (u32 arg0, s32 arg1);
s32 ovl_11_func_800F1954 (s32 arg0);
s32 ovl_11_func_800F1AE0 (s32 arg0);
s32 ovl_11_func_800F12D0 (s32 arg0, s32 arg1);
void ovl_11_func_800DBC04 (s32 arg0);
s32 ovl_11_func_800EEBF4 (s32 arg0);
s32 ovl_11_func_800F1EE4 (s32 arg0);
s32 ovl_11_func_800C3548 (s32 arg0);
void ovl_11_func_800F1E44 (u32 arg0, s16 *arg1, s32 arg2);
s32 ovl_11_func_800F19C8 (s32 arg0);
s32 ovl_11_func_800F13D8 (u16 arg0);
s32 ovl_11_func_800F1BD0 (s32 arg0);
s32 ovl_11_func_800F1C48 (s32 arg0);
s32 ovl_11_func_800F1CC4 (s32 arg0);
void ovl_11_func_800F27B0 (s16 kind, s16 value);
void ovl_11_func_801037EC (void);
s32 func_8001FABC (s16 arg0);
s32 ovl_11_func_800D5C3C (s16 arg0);
s32 ovl_11_func_800DADB0 (s16 *arg0, s16 *arg1, s32 arg2, Ovl11D124Entry *arg3, s32 arg4);
s32 ovl_11_func_800EC354 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800C1224 (s16 arg0, s16 arg1);
void ovl_11_func_80111F10 (void);
void ovl_11_func_800F0FB0 (s32 arg0);
void ovl_11_func_800DBAB0 (void);

extern M2C_a34e94965883_M2C_800EEFB8_Arg1 D_80071CC0;
extern M2C_a34e94965883_M2C_800EEFB8_Arg1 D_8007AD10[];

void ovl_11_func_800EF6E4(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    M2C_a34e94965883_M2C_800EEFB8_Arg1 *temp_s0;
    u8 *temp_v1;
    char *base;
    s16 var_a2;
    s16 var_s0;
    s16 var_s1;
    s16 var_s2;
    u8 *temp_v0;

    var_s0 = arg0;
    var_s2 = arg1;
    if (var_s2 == 5) {
        var_s2 = 4;
        var_s0 = 0;
        func_8001AF70(0x25U, 1U);
        base = (char *) D_8006C838;
        base += 0x8000;
        (*(u16 *) (base + 0x47BA)) = (u16) ((*(u16 *) (base + 0x47BA)) | 8);
        (*(u16 *) (base + 0x3E96)) = (u16) ((*(u16 *) (base + 0x3E96)) | 8);
    }
    if (var_s0 == 2) {
        var_a2 = 0x29;
        var_s1 = var_s2;
    } else {
        switch (var_s2) {
        case 0:
            var_s1 = 3;
            var_a2 = 0x13;
            break;
        case 1:
            var_s1 = 7;
            var_a2 = 0xB;
            break;
        case 2:
            var_s1 = 9;
            var_a2 = 8;
            break;
        case 3:
            var_s1 = 0xE;
            var_a2 = 5;
            break;
        case 4:
        default:
            var_s1 = 0x14;
            var_a2 = 0x19;
            break;
        }
    }
    if (var_s0 != 0) {
        temp_s0 = &D_80071CC0;
        temp_s0->unk8 = 0x29;
        temp_s0->unkA = var_s1;
        ovl_11_func_800EEFB8(-1, temp_s0);
        ovl_11_func_800EF870(var_s2);
        temp_v0 = (u8 *) temp_s0 - 0x5488;
        temp_v1 = temp_v0 + var_s1 * 0x1D4;
        (*(u16 *) (temp_v1 + 0x9A06)) = (u16) ((*(u16 *) (temp_v1 + 0x9A06)) | 8);
        return;
    }
    temp_s0 = &D_8007AD10[var_s2];
    temp_s0->unk8 = var_a2;
    temp_s0->unkA = var_s1;
    ovl_11_func_800EEFB8(var_s2, temp_s0);
}
