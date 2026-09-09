#include "common.h"

extern s32 D_80070D30;
extern s32 D_800719F8;

void ovl_11_func_8011256C(void) {
    s32 *base;
    struct_80076220 *iter;
    s32 i;

    base = &D_800719F8;
    *base &= ~0x100;

    if (!(*(s32 *)((u8 *)base - 0xCC8) & 0x200000)) {
        iter = &D_80076220;
        for (i = 0; i < 37; i++) {
            if (*(u16 *)((u8 *)iter + 4) > 0xC350U) {
                *base |= 0x100;
            }
            iter++;
        }
    }
}