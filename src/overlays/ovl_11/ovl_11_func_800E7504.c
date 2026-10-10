#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void ovl_11_func_80107DD0 (s16 *arg0);
u8 *ovl_11_func_800EFF04 (s32 arg0, s32 arg1, s32 *arg2);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001585C (ObjectState *obj, s8 arg1);
void ovl_11_func_800CF36C (s32 arg0);
s32 ovl_11_func_800E5C60 (s16 arg0, s16 arg1, s32 arg2);
s32 ovl_11_func_800E5B84 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);

struct struct_8006C838_800E7504 {
    char pad_000[0x4450];
    s32 field_4450;
};

s32 ovl_11_func_800E7504(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 sp10[4];
    s32 var_s0;
    s32 *var_s1_2;
    s32 temp_v1;
    s32 var_s1;
    struct_80076220 *temp_v0;
    struct_80076220 *base;

    switch (arg0) {                                 /* irregular */
    case 42:
        var_s0 = 1;
        var_s1 = 0x20000;
        do {
            ovl_11_func_800E7504(var_s0, (s16) (var_s1 >> 0x10), var_s0 + 2, var_s0 + 3);
            var_s0 += 4;
            var_s1 += 0x40000;
        } while (var_s0 < 0x25);
        break;
    case 45:
        ((struct struct_8006C838_800E7504 *)D_8006C838)->field_4450 |= 2;
        break;
    default:
        base = &D_80076220;
        var_s1_2 = sp10;
        var_s0 = 3;
        sp10[0] = (s32) arg0;
        sp10[1] = (s32) arg1;
        sp10[2] = arg2;
        sp10[3] = arg3;
        do {
            temp_v1 = *var_s1_2;
            if ((u32) (temp_v1 - 1) < 0x24U) {
                temp_v0 = (struct_80076220 *)(temp_v1 * 468 + (u32)base);
                (*(s32 *) ((u8 *) temp_v0 + 0x60)) = (s32) (*(s32 *) ((u8 *) temp_v0 + 0x30));
                (*(s32 *) ((u8 *) temp_v0 + 0x64)) = (s32) (*(s32 *) ((u8 *) temp_v0 + 0x34));
                temp_v0->unk30[0x84] = 0;
                (*(s32 *) ((u8 *) temp_v0 + 0x70)) = 0;
                (*(s32 *) ((u8 *) temp_v0 + 0x74)) = 0;
                (*(s32 *) ((u8 *) temp_v0 + 0x78)) = 0;
                (*(s32 *) ((u8 *) temp_v0 + 0x68)) = (s32) (*(s32 *) ((u8 *) temp_v0 + 0x38));
                (*(s32 *) ((u8 *) temp_v0 + 0x6C)) = (s32) (*(s32 *) ((u8 *) temp_v0 + 0x3C));
                temp_v0->unk1E |= 0x1000;
                (*(u16 *) ((u8 *) temp_v0 + 0x20)) = (u16) ((*(u16 *) ((u8 *) temp_v0 + 0x20)) & 0x3FFF);
                ovl_11_func_80107DD0((s16 *) &temp_v0->unk30[0xB0]);
            }
            var_s0 -= 1;
            var_s1_2 += 1;
        } while (var_s0 >= 0);
        break;
    }
    return 1;
}
