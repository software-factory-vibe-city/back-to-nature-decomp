#include "common.h"

typedef struct {
    char pad_0[0x524C];
    s16 field_524C;
    s16 field_524E;
    char pad_1[0x2];
    s16 field_5252;
    s16 field_5254;
} StoreView;

s32 ovl_11_func_800E8D00(s16 arg0, s32 arg1, s32 arg2) {
    s16 var_a1;
    s16 var_v1;

    if ((arg1 << 0x10) == 0) {
        StoreView *view = (StoreView *)&D_8006C838;
        var_a1 = view->field_524C;
        var_v1 = view->field_524E;
    } else {
        StoreView *view = (StoreView *)&D_8006C838;
        var_a1 = view->field_5252;
        var_v1 = view->field_5254;
    }
    if ((arg2 != 0) && (var_a1 == 0xA4)) {
        var_a1 = var_v1;
    }
    if (var_a1 == 0) {
        return 0;
    }
    if (arg0 != -1) {
        D_80129560[arg0] = var_a1;
    }
    return 1;
}
