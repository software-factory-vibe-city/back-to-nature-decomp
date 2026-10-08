#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);
u16 *ovl_11_func_800CE744(s32 arg0, s32 arg1);

void ovl_11_func_800CF95C(Ovl11Func800CF95CArg arg0, s32 arg1) {
    char *base;
    char *s0;

    base = (char *)D_8006C838;
    if (*(s16 *)(base + 0xE4C8) != 0) {
        return;
    }
    if (func_80012A34(0x32) != 0) {
        return;
    }
    if (*(s16 *)(base + 0x44BA) == 3) {
        return;
    }
    s0 = (char *)ovl_11_func_800CE744(arg1 == 1 ? 0x156 : 0x157, -1);
    if (s0 == 0) {
        return;
    }
    *(s32 *)(s0 + 0x38) = arg0.unk0;
    *(s32 *)(s0 + 0x3C) = arg0.unk4;
    *(s32 *)(s0 + 0x40) = arg0.unk8;
    if (arg1 == 1) {
        *(u16 *)(s0 + 0x22) = *(u16 *)(base + 0x5200);
    } else {
        *(u16 *)(s0 + 0x22) = func_80012A34(2) != 0 ? 0 : 3;
    }
}
