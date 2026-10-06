#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D812C(s16 arg0, s16 arg1, Vec3 *arg2, s16 arg3) {
    s32 ret;
    s32 y;
    s32 x;

    if (arg3 == 0) {
        x = arg0 * 400 - 0x1068;
        y = arg1 * 400;
        arg2->x = x;
        ret = 0x578;
    } else {
        x = arg0 * 400 - 0x58C;
        y = arg1 * 400;
        arg2->x = x;
        ret = 0x3FC;
    }
    ret -= y;
    arg2->z = ret;
    return ret;
}
