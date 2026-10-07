#include "common.h"

typedef struct {
    char pad_0[0x4];
    s16 unk4;
    char pad_6[0xA];
    s16 unk10;
    char pad_12[0x2];
    s16 unk14;
} ReconA0View;

typedef struct {
    char pad_0[0x10];
    s16 unk10;
    char pad_12[0x2];
    s16 unk14;
} ReconA1View;

s32 ovl_19_func_800BA564(ReconA0View *arg0, ReconA1View *arg1);
s32 ovl_19_func_800BA628(ReconA0View *arg0, ReconA1View *arg1);

s32 ovl_19_func_800BA468(ReconA0View *arg0, ReconA1View *arg1) {
    s32 var_a2;
    s32 temp;
    s16 *base;

    temp = ovl_19_func_800BA564(arg0, arg1);
    base = D_800BF4C0;
    if (base[0xBA] < temp) {
        return 0;
    }
    var_a2 = ovl_19_func_800BA628(arg0, arg1) - (arg0->unk4 << 0xA);
    if (var_a2 < 0) {
        var_a2 += 0x1000;
    }
    if ((((base[0xB9] << 0xC) / 360) < var_a2) && (var_a2 < (((0x168 - base[0xB9]) << 0xC) / 360))) {
        return 0;
    }
    return 1;
}
