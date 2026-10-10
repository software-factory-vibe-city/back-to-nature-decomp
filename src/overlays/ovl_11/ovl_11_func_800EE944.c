#include "common.h"

s32 ovl_11_func_800EE7BC(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

s16 ovl_11_func_800EE944(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 *base;
    s32 *temp_s0;
    s32 temp_t0;

    ovl_11_func_800EE7BC(1, arg0, 0, 0);
    base = D_80129560;
    temp_s0 = (s32 *) ((u8 *) base + (arg0 * 4));
    temp_t0 = *temp_s0;
    *temp_s0 = 0x7B7;
    if (temp_t0 == 1) {
        D_80129560[arg1] = 0x7BA;
    } else if (temp_t0 == 2) {
        D_80129560[arg1] = 0x7BB;
    } else if (temp_t0 == 4) {
        D_80129560[arg1] = 0x7B9;
    } else {
        D_80129560[arg1] = 0x7B8;
    }
    if (((struct struct_8006C838_800EE944 *) D_8006C838)->field_AE30 != 0x13) {
        D_80129560[arg1] += 4;
    }
    if (temp_t0 == 3) {
        D_80129560[arg2] = 0x7C1;
    } else if (temp_t0 == 0) {
        D_80129560[arg2] = 0x7C2;
    } else {
        D_80129560[arg2] = 0x7C0;
    }
    D_80129560[arg3] = D_801249EC[temp_t0] + 0x7C3;
    return 1;
}
