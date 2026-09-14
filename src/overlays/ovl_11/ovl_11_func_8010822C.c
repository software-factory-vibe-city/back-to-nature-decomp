#include "common.h"

extern s16 D_801278E4[4];

void ovl_11_func_8010822C(s16 arg0, s16 arg1) {
    s16 val;
    s16 state;

    if (arg0 >= 3) {
        if (arg0 == 3) {
            val = 0x270;
            state = 7;
        } else {
            val = 0x275;
            state = 8;
        }
    } else {
        val = D_801278E4[arg1];
        state = 4;
        if (arg0 > 0) {
            val = val + 1;
            if (arg0 == 1) {
                state = 5;
            } else {
                state = 6;
            }
        }
    }
    D_8012D050[0].field_0 = val;
    D_8012D050[0].field_2 = state;
}
