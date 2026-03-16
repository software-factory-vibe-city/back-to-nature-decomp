#include "common.h"
#include "game_types.h"

void func_800215EC(s32 arg0, s32 arg1, s32 arg2) {
    Vec3 *vec = (Vec3 *)&D_8006C7B8;
    vec->x = arg0;
    vec->y = arg1;
    vec->z = arg2;
}
