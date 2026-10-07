#include "common.h"
#include "game_types.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} SwapStruct_B45C;

char *ovl_11_func_800FB4B0(s32 arg0);
s32 ovl_11_func_800FB218(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800FB290(SwapStruct_B45C *arg0, s32 arg1, SwapStruct_B45C *arg2, s32 arg3);
s32 ovl_11_func_800FB394(Recon_ovl_11_func_800FB394_A0View *arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800FB120(s32 arg0, s32 arg1) {
    s16 *p0;
    s16 *p1;

    if (arg0 == arg1) {
        return 1;
    }
    p0 = (s16 *)ovl_11_func_800FB4B0(arg0);
    p1 = (s16 *)ovl_11_func_800FB4B0(arg1);
    if (p0[0] == 0) {
        if (p1[0] == 0) {
            return 0;
        }
        goto block_8;
    }
    if (p1[0] == 0) {
        return ovl_11_func_800FB218((s32)p0, arg0, (s32)p1, arg1);
    }
block_8:
    if (p0[0] == 0) {
        return ovl_11_func_800FB218((s32)p1, arg1, (s32)p0, arg0);
    }
    if (p0[0] == p1[0]) {
        return ovl_11_func_800FB394((Recon_ovl_11_func_800FB394_A0View *)p0, arg0, (s32)p1, arg1);
    }
    return ovl_11_func_800FB290((SwapStruct_B45C *)p0, arg0, (SwapStruct_B45C *)p1, arg1);
}
