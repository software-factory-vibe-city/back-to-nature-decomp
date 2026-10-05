#include "common.h"

extern s32 D_80076280[];
extern s16 ovl_11_func_800EEBB8(void);

void ovl_11_func_800E4428(void) {
    u16 *p;
    char *far_base;

    if ((D_8006C844 & 0x400000) && (ovl_11_func_800EEBB8() != -2) && (ovl_11_func_800EEBB8() != -1)) {
        p = (u16 *)((char *)D_80076280 + ovl_11_func_800EEBB8() * 0x1D4);
        far_base = (char *)&D_8007AFF0;
        *(s16 *)(far_base + 0x253B4) = p[0];
        *(s16 *)(far_base + 0x253B6) = p[2];
        *(s16 *)(far_base + 0x253B8) = p[4];
    }
}
