#include "common.h"

extern s16 *D_80126254[];
extern s32 *D_80125528[];
extern u8 D_800957F8[];

s32 ovl_11_func_800D688C(s16 arg0) {
    char *far_base = (char *)&D_8007AFF0;
    s16 *hdr = *(s16 **)(far_base + 0x25388);
    s32 idx;
    s16 *sp;
    s32 *wp;
    s32 n;
    s32 i;

    if (hdr == 0) {
        return 0;
    }
    idx = hdr[5];
    if (idx == -1) {
        return 0;
    }
    sp = D_80126254[idx];
    wp = D_80125528[idx];
    if (sp == 0) {
        return 0;
    }
    n = sp[0] + 1;
    sp += 1;
    wp += 1;
    i = 1;
    while (i < n) {
        if (arg0 == sp[0]) {
            return wp[0] + (s32)D_800957F8;
        }
        i += 1;
        sp += 1;
        wp += 1;
    }
    return 0;
}
