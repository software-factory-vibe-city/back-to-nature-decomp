#include "common.h"

typedef struct {
    /* 0x000 */ char pad_000[0x0C];
    /* 0x00C */ s32 field_0C;
    /* 0x010 */ char pad_010[0xE4C2];
    /* 0xE4D2 */ s16 field_E4D2;
} OvC188CView;

void ovl_11_func_800C188C(void) {
    char *far_base;
    s32 temp;

    if (ovl_11_func_800C0824() == 1) {
        ovl_11_func_800FB628();
        return;
    }
    if (((OvC188CView *)D_8006C838)->field_0C & 0x10000000) {
        return;
    }
    temp = func_8001AF44(2);
    if (temp == 1) {
        far_base = (char *)&D_8007AFF0;
        if (*(u16 *)(*(s32 *)(far_base + 0x25388) + 8) & 0x1000) {
            if (func_8001AF44(0xB0) == 1) {
                ovl_11_func_800FB628();
                return;
            }
            if (*(u16 *)(*(s32 *)(far_base + 0x25388) + 8) & 0x1000) {
                goto block_9;
            }
        }
        if (func_8001AF44(5) == 1) {
            ovl_11_func_800FB628();
            return;
        }
        if (func_8001AF44(4) == 1) {
            ovl_11_func_800FB608();
            return;
        }
    }
block_9:
    if (((OvC188CView *)D_8006C838)->field_E4D2 != 0) {
        ovl_11_func_800FB608();
        return;
    }
    ovl_11_func_800FB628();
}
