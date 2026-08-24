#include "common.h"

void ovl_11_func_800DAF24(u16 *arg0) {
    u16 temp_v1 = arg0[1];

    if (temp_v1 == 0x169) {
        arg0[1] = 0x168U;
        if (arg0[0] == temp_v1) {
            arg0[0] = 0x168U;
        }
    } else if (temp_v1 == 0x16B) {
        arg0[1] = 0x16AU;
    }
}
