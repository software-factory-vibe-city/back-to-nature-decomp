#include "common.h"

void ovl_11_func_801082B0(s16 x, s16 y) {
    s32 v;

    v = x * 0x1E + y;
    D_8012D050_halfwords[2] = (s16) (v + 0x277);
    D_8012D050_halfwords[3] = 0;
    D_8012D050_halfwords[6] = (s16) (v + 0x2EF);
    D_8012D050_halfwords[7] = 1;
}
