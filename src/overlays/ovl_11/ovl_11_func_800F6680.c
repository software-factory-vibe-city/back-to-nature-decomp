#include "common.h"
extern s16 D_80126E2C;

extern s32 D_80126E40;

extern s16 D_80126E44;

extern s16 D_80126E46;

extern s16 D_80126E48;

extern s16 D_80126E4A;

extern s16 D_80126E4C;

extern s16 D_80126E4E;

extern s16 D_80126E50;

extern s16 D_80126E52;

void ovl_11_func_800F69D0(void);

void ovl_11_func_800F6680(void) {
    D_80126E40 = 0xFF;
    D_80126E44 = 0;
    D_80126E46 = 0;
    D_80126E48 = 0xFF;
    D_80126E4A = 0;
    D_80126E4C = 0;
    D_80126E4E = 0xFF;
    D_80126E50 = 0;
    D_80126E52 = 0;
    D_80126E2C = 0;
    ovl_11_func_800F69D0();
}
