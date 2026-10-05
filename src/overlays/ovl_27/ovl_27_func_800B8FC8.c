#include "common.h"

void ovl_27_func_800B92E4(void);
void ovl_27_func_800B93B4(s16 arg0);
void ovl_27_func_800B9368(s16 arg0);
void ovl_27_func_800B9400(s16 arg0);
void ovl_27_func_800B9064(void);

extern s32 D_800C4A14;
extern s32 D_800C4A1C;

void ovl_27_func_800B8FC8(void) {
    ovl_27_func_800B92E4();
    ovl_27_func_800B93B4(0);
    ovl_27_func_800B9368(0);
    if ((D_800C4A1C % 30) < 0xF) {
        ovl_27_func_800B9400(0);
    }
    if (D_800C4A1C >= 0x5A) {
        D_800C4A14 = (s32)ovl_27_func_800B9064;
    }
}
