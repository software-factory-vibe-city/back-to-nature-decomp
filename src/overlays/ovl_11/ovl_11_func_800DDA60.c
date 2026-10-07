#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x12];
    /* 0x12 */ s16 unk12;
} Ovl11FuncDDA60Entry;

s32 func_8001AF44(u32 arg0);

extern Ovl11FuncDDA60Entry *D_8012919C;
extern s32 D_801291A0;

void ovl_11_func_800DDA60(void) {
    s32 temp_v0;

    if (D_8012919C == 0) {
        return;
    }
    if (D_801291A0 == 1) {
        goto L1;
    }
    if (D_801291A0 == 0) {
        goto L0;
    }
    if (D_801291A0 == 2) {
        goto L2;
    }
    if (D_801291A0 == 3) {
        goto L3;
    }
    return;
L0:
    temp_v0 = func_8001AF44(0x70U);
    if (temp_v0 == 1) {
        D_801291A0 = temp_v0;
    }
    return;
L1:
    D_8012919C->unk12 -= 0x20;
    if (D_8012919C->unk12 < -0x1BF) {
        D_8012919C->unk12 = -0x1C0;
        D_801291A0 = 2;
    }
    return;
L2:
    if (func_8001AF44(0x70U) == 0) {
        D_801291A0 = 3;
    }
    return;
L3:
    D_8012919C->unk12 += 0x20;
    if (D_8012919C->unk12 >= 0) {
        D_8012919C->unk12 = 0;
        D_801291A0 = 0;
    }
}
