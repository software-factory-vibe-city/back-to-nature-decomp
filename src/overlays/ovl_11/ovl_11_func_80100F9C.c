#include "common.h"

extern u16 D_80071318[11];
extern u16 D_801273EE;
extern u16 D_8012CF00[8];

void ovl_11_func_80100F9C(s32 arg0) {
    u16 *var_a1;
    u16 *var_a3;
    s32 var_a2;
    u16 temp_v0;
    u8 *temp_v1;

    var_a3 = &D_8012CF00[0];
    temp_v1 = (u8 *)&D_80071318[0] + ((arg0 & 0xFF) * 0x16);
    var_a1 = (u16 *)(temp_v1 + 6);
    var_a2 = 7;
    D_801273EE = *(u16 *)(temp_v1 + 4);
    do {
        temp_v0 = *var_a1;
        var_a1++;
        var_a2--;
        *var_a3 = temp_v0;
        var_a3++;
    } while (var_a2 >= 0);
}
