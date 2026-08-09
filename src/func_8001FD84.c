#include "common.h"
#include "psyq/libsnd.h"

void func_8001FD84(void) {
    s32 temp_a0;
    s32 temp_v1;
    s32 var_a0;
    s32 clamp;

    temp_v1 = D_80061F08.field_08 + D_80061F08.field_0C;
    D_80061F08.field_08 = temp_v1;
    if (temp_v1 <= 0) {
        D_80061F08.field_08 = 0;
        D_80061F08.field_04 = 0;
    }
    clamp = 0x7F0000;
    if (D_80061F08.field_08 > clamp) {
        D_80061F08.field_08 = clamp;
        D_80061F08.field_04 = 0;
    }
    var_a0 = D_80061F08.field_08;
    if (var_a0 < 0) {
        var_a0 += 0xFFFF;
    }
    temp_a0 = var_a0 >> 0x10;
    SsSetMVol(temp_a0, temp_a0);
}
