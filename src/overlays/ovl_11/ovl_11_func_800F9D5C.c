#include "common.h"

extern s16 D_80070CF4;
extern s32 D_80126F7C;
extern s32 D_80126F84;
extern s32 D_80126F88;

void func_8001FABC(s16 arg0);

void ovl_11_func_800F9D5C(void) {
    s32 temp;

    ovl_11_func_800F9D3C();
    temp = ovl_11_func_800F6648();
    D_80126F88 = temp;
    ovl_11_func_800F6638();
    func_8001FABC(3);
    D_80126F7C = 1;
    D_80126F84 = D_80070CF4;
}
