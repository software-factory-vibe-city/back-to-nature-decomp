#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);

void ovl_17_func_800BAEF0(void) {
    u8 *base;
    u8 *obj;
    s32 mode;
    s16 unk;

    base = D_800BD848;
    unk = *(s16 *)(base + 0xCA);
    if (unk >= 0xAA) {
        mode = 0;
    } else if (unk >= 3) {
        mode = 1;
    } else {
        mode = 2;
    }
    obj = D_800BD848;
    if (*(u8 *)(obj + 0x290) != mode) {
        func_80015840((ObjectState *)(obj + 0x28C), (s8)mode);
    }
}
