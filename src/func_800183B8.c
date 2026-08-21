#include "common.h"

/* Tentative definitions: the target reaches all four symbols via $gp, so this
 * translation unit must define them (common symbols) rather than declare them
 * extern — see configs/project-profile.md small-data threshold (-G8). */
u16 D_8005E498;
u16 D_8005E49A;
s16 D_8005E49C;
s16 D_8005E49E;

void func_800183B8(s32 arg0, s32 arg1) {
    D_8005E498 = arg0;
    D_8005E49A = arg1;
    D_8005E49C = 0;
    D_8005E49E = 0;
}
