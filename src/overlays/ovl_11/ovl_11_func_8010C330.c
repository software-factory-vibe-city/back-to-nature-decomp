#include "common.h"

/* 4-byte slot records: field_0 holds the active id (0 = free), field_2 a
 * per-id value; the slot table is shared with the ovl_11 8010C3C4/8010C4D4/
 * 8010C550/8010C668 cluster. */
typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

extern Cell4 D_80075854[];

void ovl_11_func_8010C550(Cell4 *arg0, s32 arg1);
s32 ovl_11_func_8010C668(void);

extern s16 D_80070D3C;

s32 ovl_11_func_8010C330(s32 arg0) {
    Cell4 *var_a0;
    s32 var_a2;

    if ((u32) (arg0 - 0xA1) < 3U) {
        var_a0 = D_80075854;
        for (var_a2 = 0; var_a2 < 0x63; var_a2++) {
            if (var_a0->field_0 == 0) {
                break;
            }
            var_a0 += 1;
        }
        if (var_a2 != 0x63) {
            var_a0->field_0 = (u16) arg0;
            ovl_11_func_8010C550(var_a0, arg0);
            D_80070D3C = ovl_11_func_8010C668();
            return 1;
        }
        goto block_8;
    }
block_8:
    return 0;
}
