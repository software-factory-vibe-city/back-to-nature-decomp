#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
void ovl_21_func_800BAFFC();

void ovl_21_func_800BAE20(s32 *arg0) {
    s16 temp_a1;
    s32 var_a2;

    temp_a1 = *(s16 *) ((u8 *) arg0 + 8);
    var_a2 = *(s16 *) ((u8 *) arg0 + 2) < 3;
    if (temp_a1 == 9) {
        var_a2 = var_a2 == 0;
    }
    if (temp_a1 == 6) {
        var_a2 = 0;
    }
    if ((temp_a1 + var_a2) !=
        (*(SpriteSourceData **) ((u8 *) arg0 + 0x20))->field_4) {
        func_80015840((ObjectState *) (*(SpriteSourceData **) ((u8 *) arg0 + 0x20)),
                      (*(u8 *) ((u8 *) arg0 + 8) + var_a2) & 0xFF);
    }
    ovl_21_func_800BAFFC(*(SpriteSourceData **) ((u8 *) arg0 + 0x20),
                         (u16 *) ((u8 *) arg0 + 0xA));
}
