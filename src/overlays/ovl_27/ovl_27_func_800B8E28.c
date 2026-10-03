#include "common.h"

void ovl_27_func_800B92E4(void);
void ovl_27_func_800B8E5C(void);

extern s32 D_800C4A14;
extern s32 D_800C4A1C;

s32 ovl_27_func_800B8E28(void) {
    ovl_27_func_800B92E4();
    D_800C4A1C = 0;
    D_800C4A14 = (s32)ovl_27_func_800B8E5C;
    return (s32)ovl_27_func_800B8E5C;
}
