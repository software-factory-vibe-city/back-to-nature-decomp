#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800DF128(char *arg0, s32 arg1);

s8 *ovl_11_func_800DE924(s32 arg0, s32 arg1) {
    u8 *temp_s1;
    u8 *temp_s0;

    temp_s1 = (u8 *) &D_800749F4 + (arg1 * 0xB8);
    temp_s0 = (u8 *) &D_800749F4 + (arg0 * 0xB8);
    ovl_11_func_800DF128((char *) temp_s1, 0x160);
    *(s32 *) (temp_s1 + 0x38) = *(s32 *) (temp_s0 + 0x38);
    *(s32 *) (temp_s1 + 0x3C) = *(s32 *) (temp_s0 + 0x3C);
    *(s32 *) (temp_s1 + 0x40) = *(s32 *) (temp_s0 + 0x40) - 0xC8;
    *(u16 *) (temp_s1 + 0x30) = *(u16 *) (temp_s0 + 0x30);
    *(u16 *) (temp_s1 + 0x22) = *(u16 *) (temp_s0 + 0x22);
    return (s8 *) temp_s1;
}
