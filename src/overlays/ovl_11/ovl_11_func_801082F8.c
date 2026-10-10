#include "common.h"

s32 ovl_11_func_80108470(s16 arg0, s16 arg1);
s32 ovl_11_func_80108594(s16 arg0, s32 arg1);
s32 ovl_11_func_801084E0(void);

void ovl_11_func_801082F8(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s16 temp_s0_2;
    s16 temp_v1;
    s16 var_s1;
    Ovl11_801278ECEntry *temp_s0;

    if (ovl_11_func_80108470(arg1, arg2) != 1) {
        temp_s0 = &D_801278EC[arg3];
        temp_v1 = (arg0 * 0x71) - (5 - (arg2 + (arg1 * 0x1E)));
        var_s1 = temp_s0->field_2 + ovl_11_func_80108594(temp_v1, (s32) temp_s0->field_0);
        temp_s0_2 = temp_s0->field_4;
        switch (arg3) {
        case 5:
            if (temp_v1 >= 0x224) {
                var_s1 += 1;
            }
            break;
        case 6:
            if (ovl_11_func_801084E0() == 1) {
                return;
            }
            if ((arg0 == arg3) && (arg1 == 3)) {
                if (arg2 == 0xF) {
                    var_s1 = 0x182;
                }
                if (arg2 == 0x16) {
                    var_s1 = 0x178;
                }
            }
            break;
        }
        D_8012D050[2].field_0 = var_s1;
        D_8012D050[2].field_2 = temp_s0_2;
    }
}
