#include "common.h"

void func_80021604(s32 arg0) {
    s32 index;
    s32 val_hi;
    s32 val_lo;
    u32 delta;
    u32 result;

    index = D_8006C7B8.unk0;
    val_hi = D_80049370[index + 2];
    val_lo = D_80049370[index + 1];

    delta = (u32)(val_hi - val_lo);
    result = delta / 184320U;

    D_8006C7B8.unk18 = arg0;
    D_8006C7B8.unk1C = 0;
    D_8006C7B8.unk10 = 0;
    D_8006C7B8.unk14 = val_lo;
    D_8006C7B8.unkC = result;
}
