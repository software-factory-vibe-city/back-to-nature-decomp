#include "common.h"

typedef struct {
    u8 pad0[2];
    u16 unk2;
    u16 unk4;
    u8 pad6[0x18 - 0x06];
} Ovl11Func5700Entry;

extern u8 D_80126E00[];

void ovl_11_func_800F5160(s16 arg0, s16 arg1, Ovl11Func5700Entry *arg2) {
    auto s32 nested_5108(s32 arg0, s32 arg1, s32 arg2, s32 arg3) __asm__("ovl_11_func_800F5108");
    s32 temp_v0;
    s32 i;

    for (i = 0; i < arg1; i++) {
        s32 off = arg0 * 6;
        temp_v0 = nested_5108(arg2[i].unk4, *(s16 *)(D_80126E00 + off), *(s16 *)(D_80126E00 + off + 2), *(s16 *)(D_80126E00 + off + 4));
        if (temp_v0 != 0) {
            arg2[i].unk2 = temp_v0;
        }
    }
}
