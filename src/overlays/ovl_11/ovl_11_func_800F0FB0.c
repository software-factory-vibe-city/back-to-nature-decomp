#include "common.h"

extern s32 D_80070CF8;
extern s32 D_8012961C;

void ovl_11_func_800F0FB0(s32 arg0) {
    if ((D_8012961C == 1) || (func_8001AF44(2U) == 0)) {
        D_8012961C = arg0;
    }
    if ((D_80070CF8 == 6) && (ovl_11_func_800C0A28() != 0) && (D_8012961C != 8)) {
        D_8012961C = 0;
    }
}
