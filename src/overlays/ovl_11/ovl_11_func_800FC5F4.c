#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void ovl_11_func_800FC544(s32 arg0, s16 arg1, s32 arg2, s32 arg3, s16 arg4);

extern s16 D_80127264[];
extern s16 D_8012A028;

void ovl_11_func_800FC5F4(void) {
    s16 temp_s0;
    s16 *var_s1;
    s16 *var_s2;
    s32 temp_a2;
    s32 temp_v1;
    s32 var_v0;
    u32 var_s0;

    var_s0 = 0;
    var_s1 = D_80127264;
    var_s2 = &D_8012A028;
    for (; var_s0 < 4; var_s0++) {
        *((u16 *)func_8001A970((s32) var_s1[1], var_s2, 3)) = 0xFFFF;
        temp_v1 = (var_s0 + 1) * 0x18;
        temp_a2 = temp_v1 + 0x30;
        temp_s0 = var_s1[0];
        if (var_s0 & 2) {
            var_v0 = (temp_v1 + 0x48) << 0x10;
        } else {
            var_v0 = temp_a2 << 0x10;
        }
        ovl_11_func_800FC544(3, temp_s0, (s32) var_s2, 0xD4, (s16) (var_v0 >> 0x10));
        var_s1 += 2;
    }
}
