#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


long SquareRoot0(long a);

typedef struct {
    u16 unk0;
    u16 pad_02;
    u16 unk4;
} Ovl21Func800BA698Arg;

typedef struct {
    u8 pad_00[0x34];
    s32 unk34;
    u8 pad_38[0x40 - 0x38];
    u16 unk40;
    u16 pad_42;
    u16 unk44;
} Ovl21Func800BA698Rec;

s32 *ovl_21_func_800BA698(Ovl21Func800BA698Arg *arg0, s16 arg1, s16 arg2) {
    s16 temp_a0;
    s16 temp_v0;
    s32 *var_s1;
    s32 *var_v0;
    s32 var_s2;
    s32 var_s3;
    s32 var_s4;
    Ovl21Func800BA698Rec *var_s0;
    u8 *var_s5;
    u8 *raw;

    var_v0 = NULL;
    raw = (u8 *)D_800C0448;
    for (var_s4 = arg2 * 3; var_s4 < arg2 * 3 + 3; var_s4++) {
        var_s3 = var_s4 * 0x108;
        var_s2 = 0;
        if (var_s2 < *(s16 *)(raw + 0x64A)) {
            var_s5 = (u8 *)D_800C0448;
            var_s1 = (s32 *)((u8 *)D_800C0448 + 0x34 + var_s3);
            var_s0 = (Ovl21Func800BA698Rec *)((u8 *)D_800C0448 + var_s3);
            do {
                if ((var_s0->unk34 != 1) || (temp_v0 = var_s0->unk40 - arg0->unk0, temp_a0 = var_s0->unk44 - arg0->unk4, ((arg1 < (s16)SquareRoot0((temp_v0 * temp_v0) + (temp_a0 * temp_a0))) != 0))) {
                    var_s1 += 0x13;
                    var_s0 = (Ovl21Func800BA698Rec *)((u8 *)var_s0 + 0x4C);
                    var_s2 += 1;
                    if (var_s2 >= *(s16 *)(var_s5 + 0x64A)) {
                        break;
                    }
                } else {
                    return var_s1;
                }
            } while (1);
        }
    }
    return var_v0;
}
