#include "common.h"

void ovl_27_func_800B92E4(void);
void ovl_27_func_800B93B4(s16 arg0);
void ovl_27_func_800B8EF8(void);

extern s32 D_800C4A14;
extern s16 D_800C4A38;

void ovl_27_func_800B8EA0(void) {
    ovl_27_func_800B92E4();
    ovl_27_func_800B93B4(D_800C4A38);
    D_800C4A38 = D_800C4A38 + 1;
    if (D_800C4A38 >= 0) {
        D_800C4A14 = (s32)ovl_27_func_800B8EF8;
    }
}
