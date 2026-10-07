#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
void ovl_21_func_800BAFFC();

void ovl_21_func_800BAEA0(s32 *arg0) {
    if ((*(s16 *) ((u8 *) arg0 + 4)) != (*(u8 *) ((u8 *) arg0 + 0x20))) {
        func_80015840((ObjectState *) (arg0 + 7), *(u8 *) ((u8 *) arg0 + 4));
    }
    ovl_21_func_800BAFFC((SpriteSourceData *) (arg0 + 7), (u16 *) (arg0 + 3));
}
