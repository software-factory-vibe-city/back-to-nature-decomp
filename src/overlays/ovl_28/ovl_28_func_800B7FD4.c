#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libsnd.h"
#include "psyq/libgpu.h"


u_long *ClearOTagR (u_long *ot, int n);
int DrawSync (int mode);
short SsSeqOpen (unsigned long *, short);
void SsSetMono (void);
void SsSetStereo (void);
void SsStart (void);
void SsUtReverbOn (void);
void SsUtSetReverbDepth (short, short);
short SsUtSetReverbType (short);
void ovl_28_func_800B8C94 (void);
void func_8001FD10 (void);
s32 func_8001FD74 (void);
void func_8001FE00 (s32 arg0);
s32 func_8001FE6C (void);
void ovl_28_func_800B8CE4 (void);
s32 ovl_28_func_800B8D48 (void);
s32 func_80020818 (void);
s32 func_8001FB30 (s16 arg0, s16 arg1, s16 arg2, s16 arg3);
s32 func_800201C4 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4);
s32 func_80020E38 (void);
s32 func_80020E58 (void);
void func_8001FD84 (void);
void func_8001FBE4 (s32 arg0, s32 arg1);
void func_8001FBF0 (s16 arg0);
void func_8001719C (u8 *arg0);
void func_80015704 (SpriteSourceData *out, SpriteDataHeader *header, s32 arg2, s32 arg3);
void func_80015840 (ObjectState *obj, s8 arg1);

void ovl_28_func_800B7FD4(void) {
    s32 *base;

    switch (D_800B961C) {                           /* irregular */
    case 0x0:
        D_800B961C = 0xA;
        return;
    case 0xA:
        ovl_28_func_800B8C94();
        D_800B961C = (u16) D_800B961C + 1;
        return;
    case 0xB:
        func_8001FD10();
        if (func_8001FD74() != 0) {
            func_8001FE00(0xA);
            D_800B961C = (u16) D_800B961C + 1;
        }
        return;
    case 0xC:
        if (func_8001FE6C() == 0) {
            D_800B961C = 0x14;
            return;
        }
        break;
    case 0x14:
        ovl_28_func_800B8CE4();
        D_800B961C = (u16) D_800B961C + 1;
        return;
    case 0x15:
        if (ovl_28_func_800B8D48() != 0) {
            D_800B961C = 0xFF;
            return;
        }
        break;
    case 0xFF:
        D_800B961C = 0;
        func_80020818();
        func_8001FB30(0, 0, 0x23, 0x7F);
        base = (s32 *)&D_8006C838;
        base[0x1122] = base[0x1122] + 1;
        break;
    }
}
