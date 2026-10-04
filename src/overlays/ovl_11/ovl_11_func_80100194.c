#include "common.h"

extern s32 D_801273DC;
extern void ovl_11_func_8010021C(void);
extern void ovl_11_func_80100FFC(void);
extern void ovl_11_func_80103714(void);

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_800225B8(void);

void ovl_11_func_80100194(void) {
    s32 var;
    s16 val;

    func_8002261C(3, 0x3B7);
    var = func_800226A4();
    if (var == 2) {
        val = func_800225B8();
        if (val == 1) {
            D_801273DC = (s32)ovl_11_func_8010021C;
        } else if (val == 2) {
            D_801273DC = (s32)ovl_11_func_80100FFC;
        } else {
            D_801273DC = (s32)ovl_11_func_80103714;
        }
    }
}
