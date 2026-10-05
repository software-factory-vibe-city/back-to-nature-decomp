#include "common.h"

void ovl_11_func_800C1C5C(s32 arg0);
void ovl_11_func_80107DD0(s16 *arg0);
s32 ovl_11_func_800C3548(s32 arg0);

void ovl_11_func_800C1CBC(s32 arg0) {
    s32 var_s1;
    struct_80076220 *var_s0;

    var_s0 = &D_80076220;
    var_s1 = 0;
loop_1:
    if ((*(s16 *) ((u8 *) var_s0 + 0)) == -1) {
        ovl_11_func_800C1C5C((s32) var_s0);
        (*(s16 *) ((u8 *) var_s0 + 0)) = arg0;
        var_s0->unk1E |= 0x8000;
        ovl_11_func_80107DD0((s16 *) &var_s0->unk30[0xB0]);
        if (ovl_11_func_800C3548((s16) var_s1) == 1) {
            var_s0->unk4 = 0;
            var_s0->unk2 = 0;
            return;
        }
        var_s0->unk4 = 0;
        var_s0->unk2 = 0x32;
        return;
    }
    var_s1 += 1;
    var_s0 += 1;
    if (var_s1 >= 0x25) {
        return;
    }
    goto loop_1;
}
