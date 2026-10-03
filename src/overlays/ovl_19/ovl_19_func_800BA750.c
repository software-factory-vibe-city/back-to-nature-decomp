#include "common.h"

typedef struct {
    char pad_0[0x2];
    u16 unk2;
    char pad_4[0x2];
    s16 unk6;
} Recon800BA750A0View;

s32 ovl_19_func_800BA750(Recon800BA750A0View *arg0) {
    s32 var;
    u16 a;
    a = arg0->unk2;
    if (arg0->unk6 > 0) {
        var = 0;
    } else {
        var = a < 4;
    }
    return var;
}
