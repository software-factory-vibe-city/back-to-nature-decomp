#include "common.h"

s32 func_8001AF44(u32 arg0);

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_80112C28(void) {
    char *base;
    char *base_1;

    if (func_8001AF44(0x4B) == 0) {
        base = (char *)&D_8006C838;
        base = base + 0x8000;
        *(u16 *)(base + 0x677A) += 1;
    } else {
        base_1 = (char *)&D_8006C838;
        base_1 = base_1 + 0x8000;
        *(u16 *)(base_1 + 0x677A) = 0;
    }
    func_8001AF70(0x4B, 0);
    func_8001AF70(0x4C, 0);
}
