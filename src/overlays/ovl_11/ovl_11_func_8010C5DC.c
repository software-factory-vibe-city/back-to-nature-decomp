#include "common.h"

/* 4-byte cells; field_0 is the sprite index, field_2 carries a per-id value */
typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

s32 func_80012A34(s32 arg0);

void ovl_11_func_8010C5DC(Cell4 *arg0) {
    s32 s0;
    s32 n;

    s0 = ovl_11_func_8010C668();
    if (arg0->field_2 >= 0x1E) {
        n = (func_80012A34(0x64) - s0) / 25;
        arg0->field_2 = 0x14;
        if (n > 0) {
            s0 = n;
            do {
                ovl_11_func_8010C330(0xA3);
                s0 -= 1;
            } while (s0 != 0);
        }
    }
}
