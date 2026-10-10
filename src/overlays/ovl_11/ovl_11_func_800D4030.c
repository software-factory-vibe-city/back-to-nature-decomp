#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D4030(Ovl11D4030Arg *arg0) {
    s16 temp_a0;
    s16 temp_a2;
    s32 var_a1;
    u16 temp_v1;

    temp_v1 = arg0->unk0;
    var_a1 = -1;
    switch (temp_v1) {
    case 0x108:
        temp_a0 = arg0->unk30;
        if (temp_a0 == 0x1B) {
            if (func_8001AF44(0x9EU) == 0) {
                func_8001AF70(0x9EU, 1U);
                var_a1 = 0x26B;
            } else {
                var_a1 = 0x263;
            }
        } else if (temp_a0 == 0x1F) {
            if (func_8001AF44(0x9FU) == 0) {
                func_8001AF70(0x9FU, 1U);
                var_a1 = 0x26A;
            } else {
                var_a1 = 0x264;
            }
        }
        break;
    case 0x162:
        var_a1 = 0x261;
        break;
    case 0x165:
        var_a1 = 0x262;
        break;
    case 0x17A:
        temp_a2 = arg0->unk30;
        switch (temp_a2) {
        case 0x9:
            var_a1 = 0x266;
            if (((struct struct_8006C838_800D4030 *) D_8006C838)->field_99D8 == temp_a2) {
                var_a1 = 0x277;
            }
            break;
        case 0x19:
            var_a1 = 0x269;
            break;
        case 0x18:
            var_a1 = 0x267;
            break;
        case 0x35:
            var_a1 = 0x268;
            break;
        }
        break;
    case 0x17B:
        var_a1 = 0x265;
        break;
    default:
        var_a1 = -1;
        break;
    }
    if (var_a1 != -1) {
        func_8002261C(2, var_a1);
    }
    return -1;
}
