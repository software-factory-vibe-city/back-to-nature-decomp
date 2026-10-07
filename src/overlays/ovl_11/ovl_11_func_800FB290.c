#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} SwapStruct_B45C;

s32 ovl_11_func_800FB3E4(s32 arg0);
s32 ovl_11_func_800D5810(s16 arg0);
s8 ovl_11_func_800D583C(s16 arg0);
void ovl_11_func_800FB45C(SwapStruct_B45C *arg0, SwapStruct_B45C *arg1);

s32 ovl_11_func_800FB290(SwapStruct_B45C *arg0, s32 arg1, SwapStruct_B45C *arg2, s32 arg3) {
    switch (ovl_11_func_800FB3E4(arg3)) {
    case 0:
        if (ovl_11_func_800D5810(arg0->field_0) == 0) {
            return 1;
        }
    case 1:
        if (ovl_11_func_800D583C(arg0->field_0) != 0 || arg0->field_4 < 2) {
            break;
        }
        return 1;
    default:
        break;
    }

    switch (ovl_11_func_800FB3E4(arg1)) {
    case 0:
        if (ovl_11_func_800D5810(arg2->field_0) == 0) {
            return 1;
        }
    case 1:
        if (ovl_11_func_800D583C(arg2->field_0) != 0 || arg2->field_4 < 2) {
            ovl_11_func_800FB45C(arg0, arg2);
            return 0;
        }
        return 1;
    default:
        return 1;
    }
}
