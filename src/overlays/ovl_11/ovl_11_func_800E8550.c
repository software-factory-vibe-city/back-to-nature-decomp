#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017A08(s32 arg0, s32 arg1);

s32 ovl_11_func_800E8550(s16 arg0, s16 arg1, s32 arg2) {
    s16 *it;
    s16 *var_a1;
    s32 var_a0;
    s32 var_a2;

    if (arg0 != 0) {
        var_a0 = D_80129560[arg2];
    } else {
        var_a0 = arg2;
    }
    it = &D_801295B0;
    *func_8001A970(var_a0, it, 0xA) = -1;
    var_a1 = it;
    var_a2 = 0;
    if (D_801295B0 == 0xFFD) {
        do {
            var_a2++;
            var_a1++;
        } while (var_a2 < 0xB && *var_a1 == 0xFFD);
    }
    func_80017A08(arg1 & 0xFFFF, (s32)var_a1);
    return 1;
}
