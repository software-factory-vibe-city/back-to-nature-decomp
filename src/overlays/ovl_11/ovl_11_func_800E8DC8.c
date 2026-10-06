#include "common.h"
#include "psyq/stddef.h"

s32 ovl_11_func_800E5C60(s16 arg0, s16 arg1, s32 arg2, s32 arg3);
u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2);

s32 ovl_11_func_800E8DC8(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    u8 *temp_v0;

    ovl_11_func_800E5C60(arg0, 0, 0, 0);
    temp_v0 = ovl_11_func_800EFF04(0x22, arg0, NULL);
    *(s32 *)temp_v0 = D_80129560[arg2];
    *(s32 *)(temp_v0 + 4) = D_80129560[arg1];
    *(s32 *)(temp_v0 + 8) = D_80129560[arg3];
    return 1;
}
