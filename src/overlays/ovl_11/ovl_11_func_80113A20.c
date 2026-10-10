#include "common.h"

s32 func_80012A34(s32 arg0);

s32 ovl_11_func_80113A20(s32 arg0) {
    s16 var_s3;
    s16 *s0;
    s16 *s1;
    s32 s2;
    s32 a2;
    u32 i;
    s16 idx;

    var_s3 = (s16) arg0;
    idx = *(s16 *) D_8012D110;
    s0 = (s16 *) ((u8 *) D_80127FE8 + (idx << 4));
    s1 = D_80128128;
    if (var_s3 == 0x37) {
        s0 = (s16 *) ((u8 *) D_80128088 + (idx << 4));
        s1 = D_80128138;
    }
    s2 = 0;
    a2 = func_80012A34(100);
    for (i = 0; i < 8; i++, s0++) {
        s2 += *s0;
        if (a2 < s2) {
            if (var_s3 == 0x37) {
                if (s1[i] == 0x67) {
                    if (func_8001AF44(0x62) != 0) {
                        return 0;
                    }
                    func_8001AF70(0x62, 1);
                }
                if (s1[i] == 0x63) {
                    if (func_8001AF44(0x60) != 0) {
                        return 0;
                    }
                    func_8001AF70(0x60, 1);
                }
            } else if (s1[i] == 0x67) {
                if (func_8001AF44(0x61) != 0) {
                    return 0;
                }
                func_8001AF70(0x61, 1);
            }
            return s1[i];
        }
    }
    return 0;
}
