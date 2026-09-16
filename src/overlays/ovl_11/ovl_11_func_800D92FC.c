#include "common.h"

void ovl_11_func_800D92FC(s32 *arg0) {
    char *far_base = (char *)&D_8007AFF0;
    s32 var_t0;
    s32 var_t1;
    s32 var_t2;
    s32 var_a0;
    s32 var_v0;
    s32 var_v1;

    var_t0 = 0;
    var_t2 = *(s16 *)(far_base + 0x253B4);
    var_t1 = *(s16 *)(far_base + 0x253B8);
    do {
        if (var_t0 != 0) {
            var_v0 = var_t2 + 0xE10;
            var_a0 = var_t1 - 0xE10;
        } else {
            var_v0 = var_t2 - 0xE10;
            var_a0 = var_t1 + 0xE10;
        }
        var_v1 = (var_v0 + 0x1130) / 400;
        var_a0 = (var_a0 - 0x640) / -400;
        if (var_v1 < 0) {
            var_v1 = 0;
        } else if (var_v1 >= 0x2E) {
            var_v1 = 0x2D;
        }
        if (var_a0 < 0) {
            var_a0 = 0;
        } else if (var_a0 >= 0x1A) {
            var_a0 = 0x19;
        }
        arg0[var_t0 * 2] = var_v1;
        arg0[var_t0 * 2 + 1] = var_a0;
        var_t0 += 1;
    } while (var_t0 < 2);
}
