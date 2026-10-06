#include "common.h"
#include "game_types.h"

void ovl_11_func_80108B8C(void) {
    s16 y;
    s32 d;

    y = D_8012D050[2].field_2;
    if (y == 2) {
        d = D_8012D050[2].field_0 - 600;
        if ((u32)d < 9U) {
            if (((Ovl11StatesE7A2View *)D_8006C838)->states[d] == 1) {
                ((Ovl11StatesE7A2View *)D_8006C838)->states[d] = y;
            }
        }
    }
}
