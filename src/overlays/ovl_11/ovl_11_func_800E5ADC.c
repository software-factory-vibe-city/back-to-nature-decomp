#include "common.h"
#include "psyq/stddef.h"

extern u8 D_80077600[];

/* ovl_11_func_800E5C60's own source declares (s16, s16, s32); the target
 * call passes a 4th argument (a3 is cleared before the jal), so the caller
 * TU declares the full 4-argument interface here. */
s32 ovl_11_func_800E5C60(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2);

s32 ovl_11_func_800E5ADC(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    u8 *ptr;

    if (arg0 >= 0x32) {
        ptr = &D_80077600[arg0 * 0xF8];
    } else {
        ovl_11_func_800E5C60(arg0, 0, 0, 0);
        ptr = ovl_11_func_800EFF04(0x22, arg0, NULL);
    }
    *(s32 *)ptr = arg2;
    *(s32 *)(ptr + 8) = arg3;
    *(s32 *)(ptr + 4) = arg1;
    return 1;
}
