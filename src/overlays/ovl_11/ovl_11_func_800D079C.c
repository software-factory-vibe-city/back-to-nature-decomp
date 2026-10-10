#include "common.h"
#include "game_types.h"

void ovl_11_func_800D079C(s32 arg0) {
    s32 i;
    u8 *p;
    s16 a1;
    s16 tgt;
    s32 iszero;
    s32 addr;

    if (arg0 == 1) {
        i = 0;
        tgt = 5;
        p = (u8 *)&D_800749F4;
        do {
            if (*(u16 *)(p + 0) != 0 && *(s16 *)(p + 0x30) == tgt) {
                ovl_11_func_800D075C((s32)p, (s16)i, 1);
            }
            i++;
            p += 0xB8;
        } while (i < 0x14);
    } else {
        i = 0;
        tgt = 4;
        p = (u8 *)&D_800742EC;
        do {
            if (*(u16 *)(p + 0) != 0 && *(s16 *)(p + 0x30) == tgt) {
                ovl_11_func_800D075C((s32)p, (s16)i, 0);
            }
            i++;
            p += 0xB4;
        } while (i < 0xA);
    }
    i = 0;
    do {
        u8 *base = (u8 *)&D_800749F4;
        a1 = -2;
        if (((Ovl11Work19C8View *)D_80074838)->field_19C8[i * 2] != -1) {
            iszero = (i == 0);
            addr = (s32)(base + (((Ovl11Status99C8View *)D_8006C838)->field_99C8[i * 2 + 1] * 0xB8));
            if (iszero) {
                a1 = -1;
            }
            ovl_11_func_800D075C(addr, a1, 1);
        }
        i++;
    } while (i < 2);
}
