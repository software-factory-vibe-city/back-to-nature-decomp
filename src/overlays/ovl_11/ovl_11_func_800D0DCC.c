#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017A08(s32 arg0, s32 arg1);
s32 func_8002261C(s32 arg0, s32 arg1);

s32 ovl_11_func_800D0DCC(UnkStruct800DF4F0 *arg0) {
    s16 temp_a0;
    s32 var_a1;
    u16 temp_v1;
    u16 temp_v1_2;

    func_80017A08(0, (s32) ((arg0 + 2)));
    *(u16 *) func_8001A970(0x15 - (*(u16 *) ((u8 *) arg0 + 0xB2)), &D_80128D70, 2) = 0xFFFF;
    func_80017A08(1, (s32) &D_80128D70);
    temp_v1 = *(u16 *) ((u8 *) arg0 + 0xAE);
    var_a1 = 0x6C1;
    if (temp_v1 < 4U) {
        var_a1 = 0x6C0;
        if (temp_v1 == 0) {
            temp_v1_2 = *(u16 *) ((u8 *) arg0 + 0xB2);
            if (temp_v1_2 == 1) {
                var_a1 = 0x6C3;
            } else {
                if (temp_v1_2 < 0x15U) {
                    var_a1 = 0x6C2;
                    if (temp_v1_2 == 0) {
                        temp_a0 = *(s16 *) ((u8 *) arg0 + 0x16);
                        var_a1 = 0x6BE;
                        if (temp_a0 >= 9) {
                            var_a1 = 0x6BD;
                            if (temp_a0 >= 0xC9) {
                                var_a1 = 0x6BF;
                            }
                        }
                    }
                } else {
                    var_a1 = 0x6C4;
                }
            }
        }
    }
    return func_8002261C(0, var_a1);
}
