#include "common.h"

void ovl_27_func_800B92E4(void);
void ovl_27_func_800B93B4(s16 arg0);
void ovl_27_func_800B9368(s16 arg0);
void ovl_27_func_800B8F58(void);

extern s32 D_800C4A14;
extern s16 D_800C4A3A;

void ovl_27_func_800B8EF8(void) {
    ovl_27_func_800B92E4();
    ovl_27_func_800B93B4(0);
    ovl_27_func_800B9368(D_800C4A3A);
    D_800C4A3A = D_800C4A3A - 1;
    if (D_800C4A3A <= 0) {
        D_800C4A14 = (s32)ovl_27_func_800B8F58;
    }
}
