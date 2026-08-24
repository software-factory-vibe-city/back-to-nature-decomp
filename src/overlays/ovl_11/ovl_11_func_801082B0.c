#include "common.h"

extern s16 D_8012D050[];

void ovl_11_func_801082B0(s16 x, s16 y) {
    s32 v;

    v = x * 0x1E + y;
    D_8012D050[2] = (s16) (v + 0x277);
    D_8012D050[3] = 0;
    D_8012D050[6] = (s16) (v + 0x2EF);
    D_8012D050[7] = 1;
}
