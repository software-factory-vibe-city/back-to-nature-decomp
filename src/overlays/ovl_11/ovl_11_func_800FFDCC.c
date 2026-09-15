#include "common.h"

extern s32 D_801273DC;
extern s32 D_801273E0;
extern s8 D_801273E4;
extern s8 D_801273E5;
extern u8 D_801273E6;
extern s8 D_801273E7;
extern s8 D_801273E8;
extern s8 D_801273E9;
extern s8 D_801273EA;
extern s8 D_801273EB;
extern s16 D_801273EE;
extern s16 D_8012CF00[8];
extern s16 D_801273F0;
extern s8 D_801273EC;
extern s16 D_80127424;

void ovl_11_func_800FFDCC(void) {
    s32 i;

    D_801273DC = 0;
    D_801273E0 = 0;
    D_801273E4 = 0;
    D_801273E5 = 0;
    D_801273E6 = 0xFF;
    D_801273E7 = 0;
    D_801273E8 = 0;
    D_801273E9 = 0;
    D_801273EA = 0;
    D_801273EB = 0;
    D_801273EE = 0;
    for (i = 0; i < 8; i++) {
        D_8012CF00[i] = 0;
    }
    D_801273F0 = 0;
    D_801273EC = 0;
    D_80127424 = 0;
}
