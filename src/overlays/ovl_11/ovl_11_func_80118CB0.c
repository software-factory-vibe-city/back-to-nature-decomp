#include "common.h"

extern s32 D_80128210;
extern s32 D_8012D520;
extern s32 D_8012D524;
extern s32 D_8012D52C;
extern s16 D_8012D540;

s32 ovl_11_func_80118CB0(void) {
    D_8012D520 = 0;
    D_80128210 = 1;
    D_8012D524 = 0;
    D_8012D52C = 0;
    D_8012D540 = 1;
    return 1;
}
