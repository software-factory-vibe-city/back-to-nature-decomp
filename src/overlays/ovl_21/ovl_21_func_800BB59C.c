#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libcd.h"
#include "psyq/memory.h"
#include "psyq/libapi.h"
#include "psyq/libsnd.h"

typedef struct {
               s16 unk0;
               s16 unk2;
               u16 unk4;
               s16 pad6;
               s32 unk8;
               s32 unkC;
               s32 unk10;
               s32 unk14;
} M2C_5b7450153aff_Ov11_4390struct;

int CdControl (u_char com, u_char *param, u_char *result);
void CdFlush (void);
CdlLOC *CdIntToPos (int i, CdlLOC *p);
int CdRead (int sectors, u_long *buf, int mode);
void CdReadBreak (void);
int CdReadSync (int mode, u_char *result);
int CdSync (int mode, u_char *result);
u_long *ClearOTagR (u_long *ot, int n);
int DrawSync (int mode);
int FntPrint ();
void SsSetSerialVol (char, short, short);
int StoreImage (RECT *rect, u_long *p);
void SystemError (char, long);
void *memcpy ();
void *memmove (unsigned char *, const unsigned char *, int);
void *memset ();
void func_8001719C (u8 *arg0);
s32 func_8001205C (void);
void func_80021B20 ();
s32 func_800129E8 (void);
void func_80015880 (SpriteSourceData *src, s32 header, s32 field_18);
void func_80017300 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);
s32 *func_80021FE4 (void);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
s32 func_8001AF44 (u32 arg0);
void func_8001AF70 (u16 arg0, u16 arg1);
s16 func_80022AF0 (void);
void func_80022FE0 (s32 *arg0);
void func_800179E8 (void);
void func_80015704 ();
void func_80022008 (void);
void ovl_11_func_800BD160 (void);
void ovl_11_func_800BD168 (void);
s32 func_8001FD74 (void);
void func_8001E160 (void);
void func_8001B530 (void);
void ClearVal8005E2CC (void);
s32 func_80020818 (void);
void func_8001FE00 (s32 arg0);
void func_800132B8 (s32 arg0, s32 arg1, s32 arg2);
void ovl_11_func_800CD0C0 (s32 *arg0);
void ovl_11_func_800CCC5C (void);
void ovl_11_func_800C1C90 (void);
void ovl_11_func_800F4114 (void);
void ovl_11_func_80121318 (void);
void ovl_11_func_800F0FB0 (s32 arg0);
u32 Rand (s32 arg0);
void ovl_11_func_800F1038 (u16 arg0, s32 arg1);
void func_80015894 (SomeStruct *arg0, s32 arg1);
void ovl_11_func_800C0D9C (s32 arg0);
s32 ovl_11_func_800C2884 (s16 key, u32 *table);
void ovl_11_func_800D3200 (s32 arg0);
s32 ovl_11_func_800E39B8 (s32 *arg0, u32 arg1);
void ovl_11_func_800E5230 (void);
s32 func_80012098 (void);
void func_800121D4 (void);
s32 ovl_11_func_800E3978 (s32 arg0);
s32 ovl_11_func_800EEBC8 (void);
void ovl_11_func_800E54C8 (void);
s32 func_80013394 (void);
s32 ovl_11_func_800E4AEC (s32 arg0);
s32 GetVal8005E3B0 (void);
s32 ovl_11_func_800E4C30 (s32 arg0);
s32 ovl_11_func_800E4C84 (s32 arg0);
s32 ovl_11_func_800E4B6C (s32 arg0, s32 arg1);
void ovl_11_func_800E4BA4 (s32 arg0);
void ovl_11_func_800E4D08 (s32 arg0);
s32 ovl_11_func_800E4B58 (s32 arg0, s32 arg1);
void func_80017240 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void func_80015868 (Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void ovl_11_func_800F4390 (M2C_5b7450153aff_Ov11_4390struct *arg0, s32 arg1);
s32 ovl_11_func_800E63C8 (s16 arg0, s16 arg1);
void ovl_11_func_80107DD0 (s16 *arg0);
void ovl_11_func_800C08E8 (s32 arg0);
void func_80017200 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
s32 ovl_11_func_80112A84 (void);
s32 ovl_11_func_800FEB14 (void);
s32 ovl_11_func_800FEB68 (void);
s32 ovl_11_func_800FEBB0 (void);
s32 ovl_11_func_800FEAD4 (void);
s32 ovl_11_func_800F3C9C (u16 arg0);
void func_8001FABC (s16 arg0);
void func_80021D64 (void);
void ovl_11_func_80104A80 (void);
void ovl_11_func_801047FC (void);
void ovl_11_func_800D6628 (void);
void ovl_11_func_800BFEA4 (void);
void ovl_11_func_800BFF00 (void);
void ovl_11_func_800DBFA0 (void);
void ovl_11_func_800DAFD4 (void);
void ovl_11_func_800DB0E4 (void);
void ovl_11_func_800DBFC4 (void);
void ovl_11_func_800D7B24 (void);
void ovl_11_func_800BD358 (void);
void ovl_11_func_800BD5A0 (void);
void ovl_11_func_800BD538 (void);
void ovl_11_func_800DC990 (void);
void ovl_11_func_800DCECC (void);
void ovl_11_func_800F6630 (void);
void ovl_11_func_800CBEF8 (void);
void ovl_11_func_80107F18 (void);
void ovl_11_func_8011F0C4 (void);
void func_800226F0 (void);
s32 *ovl_11_func_80111E38 (void);
void ovl_11_func_800F2508 (void);
void ovl_11_func_80104898 (void);
void ovl_11_func_800FFA28 (void);
void ovl_11_func_801128B4 (void);
void ovl_11_func_800BD668 (void);
void ovl_11_func_80104A58 (void);
void ovl_11_func_80104A88 (void);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001585C (ObjectState *obj, s8 arg1);

s32 func_80014CBC(s16 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5); /* static */

void ovl_21_func_800BB59C(void) {
    DrawSync(0);
    ClearOTagR((u32 *) D_8005E3C0->field_120, 0x800);
    func_80014CBC(0, 0, 0x2000, D_8005E3B0 + 0x4290, 1, 1);
    do {

    } while (func_80014CBC(0, 0, 0x2000, D_8005E3B0 + 0x4290, 1, 0) == 0);
    func_8001719C(D_8005E3B0 + 0x4290);
}
