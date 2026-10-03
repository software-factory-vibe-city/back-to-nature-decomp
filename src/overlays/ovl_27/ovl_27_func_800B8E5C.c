#include "common.h"

void ovl_27_func_800B92E4(void);
void ovl_27_func_800B8EA0(void);

extern s32 D_800C4A14;
extern s32 D_800C4A1C;

void ovl_27_func_800B8E5C(void) {
    ovl_27_func_800B92E4();
    if (D_800C4A1C >= 0x1E) {
        D_800C4A14 = (s32)ovl_27_func_800B8EA0;
    }
}
