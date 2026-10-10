#include "common.h"

void ovl_11_func_800FCBB4(s16 arg0, s16 arg1) {
    s16 temp_v0_2;
    s32 *var_s0;
    s32 temp_v0;
    s32 var_a2;
    s32 var_a3;
    s32 var_v1;
    u8 var_a2_2;
    u8 var_a3_2;

    var_a3 = 0;
    var_s0 = &D_800742EC;
    var_v1 = 0;
    var_a2 = 0x10000;
    for (; var_v1 < 0xA; var_v1++, var_s0 += 0x2D) {
        if (((*(u16 *) ((u8 *) var_s0 + 0)) != 0) && !((*(s32 *) ((u8 *) var_s0 + 0x34)) & 0x02000000)) {
            temp_v0 = var_a2;
            var_a2 += 0x10000;
            var_a3 = temp_v0 >> 0x10;
        }
        if (var_a3 == arg0) {
            break;
        }
    }
    if (var_v1 != 0xA) {
        temp_v0_2 = arg1 + 4;
        ovl_11_func_800FE558(arg0, 0x18, temp_v0_2);
        var_a3_2 = 0;
        var_a2_2 = 0xE;
        if ((*(u16 *) ((u8 *) var_s0 + 0)) != 0x10A) {
            var_a2_2 = 0xF;
            var_a3_2 = (*(u16 *) ((u8 *) var_s0 + 0xAE)) != 0;
        }
        ovl_11_func_800FC7F0((s32) (s16) (((s16) (*(u16 *) ((u8 *) var_s0 + 0x16))) / 25), 1, var_a2_2, var_a3_2, (s32) ((var_s0 + 1)), 0x30, (s16) (s32) arg1);
        ovl_11_func_800FD21C((*(s32 *) ((u8 *) var_s0 + 0x34)) & 0x40, *(s16 *) ((u8 *) var_s0 + 0x1C), *(s16 *) ((u8 *) var_s0 + 0x1E), ovl_11_func_800FE54C((s16 *) ((u8 *) var_s0 + 0x1A)), 0xB0, (s16) (s32) temp_v0_2);
    }
}
