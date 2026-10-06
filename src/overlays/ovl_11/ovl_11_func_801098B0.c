#include "common.h"
#include "game_types.h"

/* Callee prototype as the original caller TU saw it: the callee is defined
 * with the Ovl11Func801097F4Arg aggregate passed by value, whose first 16
 * bytes ride in $a0-$a3 and whose tail words occupy the outgoing argument
 * area; the caller-side view is the equivalent seven-word scalar list. */
s32 ovl_11_func_801097F4(s32 a0, s32 a1, s32 a2, s32 a3, s32 a4, s32 a5, s32 **out);

s32 ovl_11_func_801098B0(Ovl11Func801098B0Arg *arg0) {
    s16 temp_v1;
    s32 var_a0;
    s32 var_v0;

    var_v0 = 0;
    if (arg0->unk0 != 0) {
        if (arg0->unk34 & 0x8000) {
            temp_v1 = arg0->unkAC;
            var_a0 = 0x640;
            if (temp_v1 >= 0x32) {
                var_a0 = 0x7D0;
                if (temp_v1 >= 0x64) {
                    var_a0 = 0xAF0;
                    if (temp_v1 >= 0x96) {
                        var_a0 = 0x1770;
                        if (temp_v1 < 0xC8) {
                            var_a0 = 0xFA0;
                        }
                    }
                }
            }
            if (ovl_11_func_801097F4(arg0->unk38, arg0->unk3C, arg0->unk40, arg0->unk44, arg0->unk30, var_a0, &D_8012D080) == 1) {
                var_v0 = 1;
            } else {
                var_v0 = 0;
                D_8012D080 = 0;
            }
            return var_v0;
        }
    }
    return var_v0;
}
