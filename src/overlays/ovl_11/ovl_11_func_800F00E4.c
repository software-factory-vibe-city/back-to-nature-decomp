#include "common.h"
#include "game_types.h"

s32 func_8001AF44(u32 arg0);
s32 ovl_11_func_800F021C(s16 arg0);

s32 ovl_11_func_800F00E4(void) {
    s16 *var_s0;
    s16 *var_s0_2;
    s32 var_s5;
    u8 *base;
    s32 var_s1;
    s32 var_s1_2;
    s32 var_s2;
    s32 var_s3;
    s32 var_s6;
    s32 var_v0;
    s32 var_v0_2;

    var_s3 = 0;
    var_s6 = 0x465;
    if (func_8001AF44(0x3EU) == 1) {
        s32 var_s4;

        var_s6 = 0x496;
        var_s4 = 1;
        base = (u8 *) D_8006C838;
        var_s5 = 0x78EE + (s32) base;
        for (var_s2 = 0; var_s2 < 7; var_s2++) {
            var_v0 = var_s2 * 8;
            var_s0 = (s16 *) (var_v0 + var_s5);
            for (var_s1 = 6; var_s1 >= 0; var_s1--) {
                if (ovl_11_func_800F021C(*var_s0) == var_s4) {
                    var_s3 += 1;
                }
                var_s0 += 0x1C;
            }
        }
    }
    {
        s32 var_s4;

        var_s2 = 0;
        var_s4 = 1;
        base = (u8 *) D_8006C838;
        var_s5 = 0x55C6 + (s32) base;
        for (; ; ) {
            var_v0_2 = var_s2 * 8;
            var_s2 += 1;
            var_s0_2 = (s16 *) (var_v0_2 + var_s5);
            var_s1_2 = 0x18;
loop_10:
            if (ovl_11_func_800F021C(*var_s0_2) == var_s4) {
                var_s3 += 1;
            }
            var_s1_2 -= 1;
            var_s0_2 += 0xB4;
            if (var_s1_2 >= 0) {
                goto loop_10;
            }
            if (var_s2 >= 0x2D) {
                break;
            }
        }
    }
    return (s32) (var_s3 * 0x64) / var_s6;
}
