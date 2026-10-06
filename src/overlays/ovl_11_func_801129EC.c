#include "common.h"

s32 func_8001AF44(u32 arg0);
void ovl_11_func_80112C28();
void ovl_11_func_80112AB4();
void ovl_11_func_80112C98();
void ovl_11_func_80112B60();
extern u8 D_8007A3F0;

void ovl_11_func_801129EC(void) {
    unsigned char *base;
    s16 idx;
    struct_80076220 *temp_s0;

    if (func_8001AF44(0x41) != 0) {
        base = (unsigned char *)&D_8006C838;
        base = base + 0x8000;
        idx = *(s16 *)(base + 0x6778);
        temp_s0 = &D_80076220;
        temp_s0 = (struct_80076220 *)((s32)temp_s0 + idx * 0x1D4);
        ovl_11_func_80112C28(temp_s0);
        ovl_11_func_80112AB4(temp_s0);
        ovl_11_func_80112C98(temp_s0);
        if (func_8001AF44(0x4F) != 0) {
            ovl_11_func_80112B60(&D_8007A3F0);
        }
    }
}
