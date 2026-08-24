#include "common.h"

/* 4-byte cells; the low u16 of each is checked for zero, 2 bytes of padding */
typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

extern Cell4 D_80075854[];

s32 ovl_11_func_8010C668(void) {
    s32 var_a1;
    s32 var_v1;
    Cell4 *var_a0;

    var_a1 = 0;
    var_a0 = D_80075854;
    var_v1 = 0x62;
    do {
        if (var_a0->field_0 != 0) {
            var_a1 += 1;
        }
        var_v1 -= 1;
        var_a0 += 1;
    } while (var_v1 >= 0);
    return var_a1;
}
