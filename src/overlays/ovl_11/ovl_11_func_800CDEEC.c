#include "common.h"
#include "game_types.h"

u32 ovl_11_func_800CDEEC(u8 *arg0) {
    u32 var_s1;
    u8 *var_s0;

    var_s1 = 0;
    var_s0 = arg0 + 0x120;
    do {
        ovl_11_func_800CE0F0((Ovl11SpritePositionView *) var_s0, arg0, 0, var_s1);
        var_s1 += 1;
        var_s0 += 0x10;
    } while (var_s1 < 5U);
    return 0U;
}
