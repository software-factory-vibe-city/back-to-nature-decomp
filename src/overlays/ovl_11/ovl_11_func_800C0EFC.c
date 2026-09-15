#include "common.h"

extern s16 D_8006C908;
extern s32 (*D_800B7F54[10])(void);
extern s32 D_80128A88;

void ovl_11_func_800C0EFC(void) {
    s32 i;

    if (D_80128A88 == -1) {
        return;
    }
    if ((*D_800B7F54[D_80128A88])() != 0) {
        D_8006C908 = 0;
        for (i = 1; i < 0x32; i++) {
            s32 v = (&D_80128A88)[i];
            (&D_80128A88)[i - 1] = v;
        }
        i += -1;
        (&D_80128A88)[i] = -1;
    }
}
