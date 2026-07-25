#include "common.h"
#include "game_types.h"

void CopyVec3(Vec3 *dest, Vec3 *src) {
    dest->x = src->x;
    dest->y = src->y;
    dest->z = src->z;
}
