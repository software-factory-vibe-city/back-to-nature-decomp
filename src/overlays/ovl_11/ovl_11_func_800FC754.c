#include "common.h"
#include "game_types.h"

void ovl_11_func_800FC7F0(s32 arg0, s32 arg1, u8 arg2, u8 arg3, s32 arg4, s16 arg5, s16 arg6);

void ovl_11_func_800FC754(void) {
    Ovl11D80127234Entry *var_s0;
    s32 temp_v0;
    u32 var_s2;

    var_s2 = 0;
    var_s0 = D_80127234;
    do {
        temp_v0 = var_s0->unk4;
        if (temp_v0 != 0) {
            ovl_11_func_800FC7F0(var_s0->unk0, (s32) var_s0->unk8, var_s0->unk9, 0U, temp_v0, 0x18, (s16) ((var_s2 * 0x180000 + 0x780000) >> 0x10));
        }
        var_s2 += 1;
        var_s0 = (Ovl11D80127234Entry *) ((u8 *) var_s0 + 0xC);
    } while (var_s2 < 4U);
}
