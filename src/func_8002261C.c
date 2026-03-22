#include "common.h"

extern s32 D_8005E5A8;
extern s32 D_8005E5AC;
extern s32 D_8005E5B4;
extern s32 D_8005E5C4;
extern s32 D_8005E5C8;

s32 func_8002261C(s32 arg0, s32 arg1) {
    s32 var_a2;
    struct struct_8006C838 *temp_v0;

    var_a2 = 1;
    temp_v0 = D_8006C838;
    if (((u8 *)temp_v0)[0xCC] == 0) {
        ((u8 *)temp_v0)[0xCC] = 1U;
        var_a2 = 0;
        D_8005E5AC = arg0;
        D_8005E5A8 = arg1;
        D_8005E5B4 = 0;
    }
    if (((u32) (((u8 *)temp_v0)[0xCC] - 5) < 2U) && ((D_8005E5AC != arg0) || (D_8005E5A8 != arg1)) && (D_8005E5C4 == -1)) {
        var_a2 = 0;
        D_8005E5C4 = arg0;
        D_8005E5C8 = arg1;
    }
    return var_a2;
}
