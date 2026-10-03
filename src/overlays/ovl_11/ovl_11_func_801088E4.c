#include "common.h"

extern s32 D_8012D040;
extern s32 D_8012D068;
extern s32 D_8012D06C;

void ovl_11_func_800BD9D4(s32 arg0);

void ovl_11_func_801088E4(void) {
    D_8012D068 = 0;
    D_8012D06C = -1;
    ovl_11_func_800BD9D4(D_8012D050[D_8012D040].field_2);
}
