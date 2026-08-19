#include "common.h"
#include "game_types.h"

/* CD/script state globals reached GP-relatively by this TU (tentative
 * definitions, merged via -fcommon with func_80022964.c / func_80022DF8.c). */
s32 D_8005E5A8;
s32 *D_8005E5B0;
s32 D_8005E5CC;

/* Callee prototypes as this caller TU saw them. */
s32 func_80022AF0(void);
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);
s32 func_80022794(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4, s32 arg5, s32 *arg6, s32 arg7, s32 arg8);
void func_80022FE0(s32 *arg0);
void func_800179E8(void);
void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
void func_80022008(void);

s32 func_800229F4(void) {
    u8 *s0;
    s32 s1;
    s8 v0;

    s0 = func_80014CBC(func_80022AF0(), D_8005E5A8 << 13, 0x2000, (u8 *)&D_8006C910, 0, 0);
    s1 = func_80022794(D_8005E3C0->field_D8 + 8, 0, 0x1A, 0xA4, 0x10B, 0x3E, &D_8005E5CC, 0xC, 1);
    if (s0 != 0) {
        func_80022FE0((s32 *)s0);
        D_8005E5B0 = (s32 *)((u8 *)&D_8006C910 + 0x1800);
        func_800179E8();
        v0 = 3;
        if (s1 == 1) {
            v0 = 4;
        }
        ((u8 *)&D_8006C910)[-0xC] = v0;
        func_80015704((SpriteSourceData *)&D_800A06D8, (SpriteDataHeader *)&D_800977F8);
        func_80022008();
    }
    return 0;
}
