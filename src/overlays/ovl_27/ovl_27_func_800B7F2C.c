#include "common.h"

extern s16 D_800C4A18;
extern s16 D_800C4A1A;
extern s32 D_800C4A1C;
extern s16 D_800C4A24;
extern s16 D_800C4A26;
extern s32 D_800C4A28;

void ovl_27_func_800B7F7C(void);

void ovl_27_func_800B7F2C(void) {
    ovl_27_func_800B7F7C();
    D_800C4A18 = 0;
    D_800C4A24 = 0;
    D_800C4A1C = 0;
    D_800C4A1A = 1;
    D_800C4A26 = 0;
    D_800C4A28 = 0;
}
