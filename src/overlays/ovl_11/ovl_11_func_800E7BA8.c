#include "common.h"

void func_80015074(s32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5,
                   s16 arg6);

s32 ovl_11_func_800E7BA8(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 var_t1;

    var_t1 = 0;
    if (arg0 != 0) {
        var_t1 = 5;
    }
    func_80015074((s32 *)(D_8005E3C0->field_D8 + var_t1 * 4), 0, 0, 0x140, 0xF0,
                  (arg3 & 0xFF) | ((arg2 & 0xFFFF) << 8) |
                      ((arg1 & 0xFF) << 0x10),
                  1);
    return 1;
}
