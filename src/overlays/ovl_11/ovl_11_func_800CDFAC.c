#include "common.h"
#include "game_types.h"

u32 ovl_11_func_800CDFAC(u8 *arg0) {
    u32 var_s2;
    u32 var_s4;
    u8 *var_s0;
    u8 *var_s1;

    var_s2 = 0;
    var_s4 = 5;
    var_s1 = arg0 + 0x1C0;
    var_s0 = arg0 + 0x3D4;
    do {
        if ((*(u16 *) var_s0) != var_s4) {
            ovl_11_func_800CE0F0((Ovl11SpritePositionView *) var_s1, arg0, 1, var_s2);
        }
        var_s1 += 0x10;
        var_s2 += 1;
        var_s0 += 4;
    } while (var_s2 < 0xAU);
    return 0U;
}
