#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void ovl_11_func_800FE558 (s16 arg0, s16 arg1, s16 arg2);
void ovl_11_func_800FC7F0 (s32 arg0, s32 arg1, u8 arg2, u8 arg3, s32 arg4, s16 arg5, s16 arg6);
s32 ovl_11_func_800FE54C (s16 *arg0);
void func_80015EE8 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_800FE834 (s16 arg0, s16 arg1, s16 arg2);
s16 *func_8001A970 (s32 arg0, s16 *arg1, s32 arg2);
void func_80024A10 (s32 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_11_func_800FCD40(s16 arg0, s16 arg1) {
    s32 *var_s1;
    s32 temp_v0;
    s32 var_a2;
    s32 var_a3;
    s32 var_v1;
    u16 temp_v1;
    u8 var_a2_2;

    var_a3 = 0;
    var_s1 = &D_800749F4;
    var_v1 = 0;
    var_a2 = 0x10000;
    for (; var_v1 < 0x14; var_v1++, var_s1 += 0x2E) {
        if ((u32) ((*(u16 *) ((u8 *) var_s1 + 0)) - 0x160) < 4U) {
            temp_v0 = var_a2;
            var_a2 += 0x10000;
            var_a3 = temp_v0 >> 0x10;
        }
        if (var_a3 == arg0) {
            break;
        }
    }
    if (var_v1 != 0x14) {
        ovl_11_func_800FE558(arg0, 0x18, (s16) (arg1 + 4));
        var_a2_2 = 9;
        if ((*(u16 *) ((u8 *) var_s1 + 0xB2)) == 0) {
            temp_v1 = *(u16 *) ((u8 *) var_s1 + 0);
            var_a2_2 = 6;
            if (temp_v1 != 0x160) {
                var_a2_2 = 8;
                if (temp_v1 == 0x161) {
                    var_a2_2 = 7;
                }
            }
        }
        ovl_11_func_800FC7F0((s32) (s16) (((s16) (*(u16 *) ((u8 *) var_s1 + 0x16))) / 25), 1, var_a2_2, 0U, (s32) ((var_s1 + 1)), 0x30, (s16) (s32) arg1);
        ovl_11_func_800FD21C((*(s32 *) ((u8 *) var_s1 + 0x34)) & 0x40, *(s16 *) ((u8 *) var_s1 + 0x1C), *(s16 *) ((u8 *) var_s1 + 0x1E), ovl_11_func_800FE54C((s16 *) ((u8 *) var_s1 + 0x1A)), 0xB0, (s16) (arg1 + 4));
    }
}
