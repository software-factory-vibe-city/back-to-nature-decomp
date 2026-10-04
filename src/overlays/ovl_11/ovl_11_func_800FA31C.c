#include "common.h"

void ovl_11_func_800FA590(s32 arg0, s16 arg1, s32 arg2);

void ovl_11_func_800FA31C(s32 arg0, s16 arg1, s16 arg2) {
    Recon_ovl_11_func_800FA31C_D80126F8CEntry *p;
    s32 i;

    p = &D_80126F8C;
    i = 0x11;
    do {
        if (p->unk0 == arg1) {
            ovl_11_func_800FA590(arg0, p->unk1, arg2);
        }
        i -= 1;
        p += 1;
    } while (i >= 0);
}
