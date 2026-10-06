#include "common.h"
#include "game_types.h"

s32 ovl_11_func_80103770(void) {
    Ovl11RowE522View *v;
    u16 sel;
    s32 i;
    s32 sum;

    v = (Ovl11RowE522View *)&D_8006C838;
    sum = 0;
    sel = 2;
    if (v->selector != 3) {
        sel = (u16) v->selector;
    }
    for (i = 0; i < 6; i++) {
        sum += v->rows[sel][i][0];
    }
    return sum == 0;
}
