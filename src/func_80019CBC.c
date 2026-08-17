#include "common.h"
#include "game_types.h"

u16 D_8005E2BA;

s32 func_80019CBC(s16 arg0, s16 arg1, u16 *arg2, s16 arg3) {
    SomeStruct *unk;
    s32 result;
    s32 value;
    s32 temp;
    s32 var_v0;
    s32 var_a0;

    result = 0;
    unk = (SomeStruct *)D_8005E3A8;
    if (unk->field_0x0 & 0x4000) {
        func_8001FABC(5);
        var_a0 = 0;
        value = *arg2 + 1;
        *arg2 = value;
        if ((s16)value < arg3) {
            var_a0 = value;
        }
        *arg2 = var_a0;
    } else if (unk->field_0x0 & 0x1000) {
        func_8001FABC(5);
        temp = *arg2 - 1;
        *arg2 = temp;
        if ((s16)temp < 0) {
            var_v0 = arg3 - 1;
        } else {
            var_v0 = temp;
        }
        *arg2 = var_v0;
    } else if (unk->field_0x8 & 0x40) {
        func_8001FABC(0);
        result = (s16)*arg2 + 1;
    }
    if (result == 0) {
        func_80019E14(D_8005E3C0->field_D8, (s16)(arg0 - 2),
                      (s16)(arg1 + ((s16)D_8005E2BA + 0xC) * (s16)*arg2));
    }
    return result;
}
