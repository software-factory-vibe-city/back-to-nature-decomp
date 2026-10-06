#include "common.h"

s32 ovl_11_func_80108470(s16 arg0, s16 arg1) {
    s16 t;

    t = 0;
    if (arg0 == 3) {
        if (arg1 >= 0x1C) {
            t = (s16) (arg1 + 0x24B);
        }
    } else if ((arg0 == 0) && (arg1 < 5)) {
        t = (s16) (arg1 + 0x262);
    }
    if (t != 0) {
        D_8012D050[2].field_0 = t;
        D_8012D050[2].field_2 = 0xA;
        return 1;
    }
    return 0;
}
