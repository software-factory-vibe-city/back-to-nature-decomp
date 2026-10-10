#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_11_func_800F06D8(s32 *arg0, s32 *arg1);

s32 ovl_11_func_800E8A24(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 offset[3];
    s32 *base;
    s32 *base2;
    u8 *ptr;
    char *far_base;
    s32 *p;
    s32 var_a2;
    u16 value;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    ptr = (u8 *)base2[0x5DD0 >> 2] + arg0 * 0x18;
    far_base = (char *)&D_8007AFF0;
    value = *(u16 *)(far_base + 0x25476);

    *(u16 *)(ptr + 0x4) |= 1;
    p = (s32 *)((char *)D_80076280 + arg1 * 0x1D4);
    *(u16 *)ptr = value;

    if (arg3 != 0) {
        var_a2 = ovl_11_func_800F06D8((s32 *)((char *)base + 0x52C8), p);
    } else {
        var_a2 = arg2 & 0xFFFF;
    }
    switch (var_a2) {
    case 0:
        offset[0] = 0;
        offset[1] = -0x64;
        offset[2] = -0x64;
        break;
    case 1:
        offset[0] = -0x64;
        offset[1] = -0x64;
        offset[2] = 0;
        break;
    case 2:
        offset[0] = 0;
        offset[1] = -0x64;
        offset[2] = 0x64;
        break;
    case 3:
        offset[0] = 0x64;
        offset[1] = -0x64;
        offset[2] = 0;
        break;
    }
    *(s32 *)(ptr + 0xC) = p[1] + offset[1];
    *(s32 *)(ptr + 0x8) = p[0] + offset[0];
    *(s32 *)(ptr + 0x10) = p[2] + offset[2];
    return 1;
}
