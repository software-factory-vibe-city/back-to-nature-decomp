#include "common.h"

typedef struct {
    char pad_0[0x24];
    u16 unk24;
    char pad_26[0x4];
    s16 unk2A;
    char pad_2C[0x4];
    s16 unk30;
    char pad_32[0x48];
    u16 unk7A;
} Ovl11Func80110494View;

s32 ovl_11_func_80110494(Ovl11Func80110494View *arg0, s16 arg1, s16 arg2) {
    if (arg0->unk24 == arg1) {
        if (arg0->unk2A >= arg2) {
            char *far_base = (char *)&D_8007AFF0;

            if (arg0->unk30 != *(s16 *)(far_base + 0x25476) || (arg0->unk7A & 0x300) != 0) {
                return 1;
            }
        } else {
            arg0->unk2A = arg0->unk2A + 1;
        }
    } else {
        arg0->unk24 = arg1;
        arg0->unk2A = 0;
    }
    return 0;
}
