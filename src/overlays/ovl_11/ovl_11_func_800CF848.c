#include "common.h"

s32 func_80012A34(s32 arg0);
u16 *ovl_11_func_800CE744(s32 arg0, s32 arg1);

void ovl_11_func_800CF848(void) {
    char *base;
    char *far_base;
    s16 *entry;
    char *s0;
    s32 i;
    s16 a2;
    u16 v;

    entry = D_80123940;
    far_base = (char *)D_8009AFF0;
    base = (char *)D_8006C838;
    for (i = 5; i >= 0; i--) {
        a2 = *(s16 *)(far_base + 0x5476);
        if (a2 != *(s16 *)(entry + 1)) {
            entry += 0xC;
            continue;
        }
        if (*entry != 0x17A || ((v = *(u16 *)(base + 0x99D8)) != 0 &&
            (entry[2] == 0 || *(u16 *)(base + 0x99D8) == a2))) {
            s0 = (char *)ovl_11_func_800CE744((s16)*(u16 *)entry, -1);
            if (s0 != 0) {
                *(s32 *)(s0 + 0x38) = *(s32 *)(entry + 4);
                *(s32 *)(s0 + 0x3C) = *(s32 *)(entry + 6);
                *(s32 *)(s0 + 0x40) = *(s32 *)(entry + 8);
                if (func_80012A34(2) != 0) {
                    *(u16 *)(s0 + 0x22) = 0;
                } else {
                    *(u16 *)(s0 + 0x22) = 2;
                }
            }
        }
        entry += 0xC;
    }
}
