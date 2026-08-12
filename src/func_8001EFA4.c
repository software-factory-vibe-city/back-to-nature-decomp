#include "common.h"
#include "game_types.h"

void func_8001F038(s32 arg0, s32 arg1, s32 arg2);
void func_8001F1E0(s32 *arg0, s32 arg1, s32 arg2, s32 arg3);
void CopyVec3(Vec3 *dest, Vec3 *src);

/* GP-relative globals — this TU defines them (tentative definitions) */
s8 D_8005E2EC;
s8 D_8005E2ED;
s8 D_8005E2EE;
s32 D_8005E2F8;
s32 D_8005E2FC;
s32 D_8005E300;
s32 D_8005E308;
s32 D_8005E30C;
s32 D_8005E310;
s32 D_8005E314;

void func_8001EFA4(void) {
    s32 *ptr_49268;
    Vec3 *ptr_49274;

    func_8001F038(0x320, 0x258, 0);

    ptr_49268 = &D_80049268;
    ptr_49274 = &D_80049274;
    D_8005E308 = -1;
    D_8005E30C = 0;
    D_8005E310 = 0;
    D_8005E314 = 0;
    D_8005E2EE = 0;
    ptr_49274->z = 0;
    ptr_49274->y = 0;
    ptr_49274->x = 0;

    func_8001F1E0(ptr_49268, D_8005E2F8, D_8005E2FC, D_8005E300);
    CopyVec3(&D_80049280, (Vec3 *) ptr_49268);

    D_8005E2ED = 1;
    D_8005E2EC = 2;
}
