#include "common.h"

extern u16 D_8013759E;
extern u16 D_801375A0;
extern u16 D_801375A2;
extern u16 D_801375A4;
extern u8 D_80140FE0[];

void ovl_15_func_80134724(void) {
    D_8013759E = 0;
    D_801375A0 = 0;
    D_801375A2 = 0;
    D_801375A4 = 0;
    memset(D_80140FE0, 0, 0x1568);
}
