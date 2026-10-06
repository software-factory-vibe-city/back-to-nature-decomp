#include "common.h"
#include "psyq/stddef.h"

u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2);
void ovl_11_func_800CF36C(s32 arg0);

s32 ovl_11_func_800E5C60(s16 arg0, s16 arg1, s32 arg2) {
    s32 var_a1;
    u8 *temp_v0;

    if (arg0 != 0x2C) {
        if (arg2 != 0) {
            var_a1 = D_80129560[arg0];
        } else {
            var_a1 = arg0;
        }
        temp_v0 = ovl_11_func_800EFF04(0x25, var_a1, NULL);
        if (arg1 == 0) {
            *(u16 *)temp_v0 |= 0x800;
        } else {
            *(u16 *)temp_v0 &= 0xF7FF;
        }
    } else {
        ovl_11_func_800CF36C(0);
    }
    return 1;
}
