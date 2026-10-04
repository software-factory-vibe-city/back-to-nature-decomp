#include "common.h"

/* ovl_19 bss state base, referenced with absolute addressing (lui + %lo). */
extern s16 D_800BF4C0[];

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_800225B8(void);

void ovl_19_func_800B93B0(void) {
    s32 temp_s0;
    s32 temp_v0;

    func_8002261C(4, 0xE);
    temp_s0 = func_800226A4();
    if (temp_s0 == 2) {
        temp_v0 = func_800225B8();
        D_800BF4C0[3] = 0;
        if (temp_v0 == 1) {
            D_800BF4C0[0x100] = 0;
            D_800BF4C0[2] = 3;
        } else if (temp_v0 == temp_s0) {
            D_800BF4C0[2] = temp_v0;
        }
    }
}
