#include "common.h"
#include "game_types.h"

void CopyVec3(Vec3 *dest, Vec3 *src) {
    register s32 temp_v1 __asm__("v1");
    register s32 temp_v0 __asm__("v0");
    
    temp_v1 = src->x;
    dest->x = temp_v1;
    temp_v0 = src->y;
    dest->y = temp_v0;
    temp_v1 = src->z;
    dest->z = temp_v1;
}
