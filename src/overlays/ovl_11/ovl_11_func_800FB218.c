#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} SwapStruct_B45C;

extern s32 ovl_11_func_800FB3E4(s32 arg0);
extern s32 ovl_11_func_800D5810(s16 arg0);
extern void ovl_11_func_800FB45C(SwapStruct_B45C *arg0, SwapStruct_B45C *arg1);

s32 ovl_11_func_800FB218(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 ret;

    ret = ovl_11_func_800FB3E4(arg3);
    switch (ret) {
    case 0:
        if (ovl_11_func_800D5810(((SwapStruct_B45C *)arg0)->field_0) != 0) {
        case 1:
            ovl_11_func_800FB45C((SwapStruct_B45C *)arg0, (SwapStruct_B45C *)arg2);
            return 0;
        }
    default:
        return 1;
    }
}
