#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void ovl_11_func_80102A64 (s32 arg0);
s32 pow_int (s32 arg0, s32 arg1);
void ovl_11_func_800D666C (s16 arg0);

extern u16 D_8012CF00;

void ovl_11_func_80102A10(void) {
    u16 *var_s0;
    s32 var_s1;

    var_s0 = &D_8012CF00;
    for (var_s1 = 7; var_s1 >= 0; var_s1--) {
        if (*var_s0 != 0) {
            ovl_11_func_80102A64((s32) *var_s0);
        }
        var_s0 += 1;
    }
}
