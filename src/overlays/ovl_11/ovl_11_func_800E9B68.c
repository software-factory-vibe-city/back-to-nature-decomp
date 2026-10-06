#include "common.h"

s32 ovl_11_func_800E9B68(s16 arg0) {
    struct_80076220 *temp_s0;
    u16 *var_s0;
    u32 var_v1;
    s16 c;

    temp_s0 = &D_80076220 + arg0;
    temp_s0->unk2C = 0x36;
    temp_s0->unk2E = 0x36;
    (*(s16 *) ((u8 *) temp_s0 + 8)) = 0;
    temp_s0->unkA = 0;
    temp_s0->unkC = 0;
    temp_s0->unkE = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x10)) = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x14)) = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x16)) = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x18)) = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x1A)) = 0;
    (*(s16 *) ((u8 *) temp_s0 + 0x1C)) = 0;
    temp_s0->unk22 = 0;
    temp_s0->unk1E = (temp_s0->unk1E | 0x8000) & 0x9E48;
    ovl_11_func_80107DD0((s16 *) &temp_s0->unk30[0xB0]);
    var_v1 = 0;
    c = 0x36;
    var_s0 = &temp_s0->unkE4[0].unk6;
    do {
        (*(s16 *) ((u8 *) var_s0 + -6)) = 0;
        (*(s16 *) ((u8 *) var_s0 + -4)) = 0;
        (*(s16 *) ((u8 *) var_s0 + -2)) = c;
        *var_s0 = c;
        var_s0 += 4;
        var_v1 += 1;
    } while (var_v1 < 0x1EU);
    return 1;
}
