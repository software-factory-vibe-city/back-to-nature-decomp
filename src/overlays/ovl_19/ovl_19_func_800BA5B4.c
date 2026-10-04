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

s32 ovl_19_func_800BA628(ReconA0View *arg0, ReconA1View *arg1);

s32 ovl_19_func_800BA5B4(ReconA0View *arg0, ReconA1View *arg1) {
    s32 t;

    t = ovl_19_func_800BA628(arg0, arg1) - (arg0->unk4 << 10);
    if (t < 0) {
        t += 0x1000;
    }
    if ((u32)(t - 0x201) < 0x400) {
        return 1;
    }
    if ((u32)(t - 0x60C) < 0x3F5) {
        return 2;
    }
    if ((u32)(t - 0xA0C) < 0x3F5) {
        return 3;
    }
    return 0;
}
