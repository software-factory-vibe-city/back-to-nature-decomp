#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_8001AF70 (u16 arg0, u16 arg1);
u16 ovl_11_func_800EAF5C (s16 arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800E6DFC(s16 arg0, s16 arg1) {
    s32 var_s2;
    s16 var_s0;

    var_s2 = 0;
    var_s0 = 0;
    if (arg0 == 0) {
        func_8001AF70(3U, 1U);
    } else if (D_8006C904 == 0) {
        func_8001AF70(3U, 0U);
        var_s2 = 1;
        var_s0 = 2;
    }
    if (arg1 != -1) {
        if (arg1 == 2) {
            var_s0 = 2;
        }
        ovl_11_func_800EAF5C(var_s0, 0, 0, 0);
    }
    return var_s2;
}
