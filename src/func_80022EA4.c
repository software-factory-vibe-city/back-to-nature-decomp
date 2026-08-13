#include "common.h"
#include "game_types.h"

void func_80022EA4(void) {
    s32 temp_v0;
    s32 var_a1;

    temp_v0 = func_80017B30();
    var_a1 = 7;
    if (temp_v0 != 0) {
        var_a1 = func_80022F1C(temp_v0);
    }
    if ((u8) _D_800A06D8[1] != var_a1) {
        func_80015840((ObjectState *) &D_800A06D8, var_a1 & 0xFF);
    }
    func_80015C50(D_8005E3C0->field_D8 + 4, (SpriteSourceData *) &D_800A06D8, 0x11D, 0xD9);
}
