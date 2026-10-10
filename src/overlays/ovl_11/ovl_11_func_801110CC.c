#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x30];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0xB6 - 0x32];
    /* 0xB6 */ u16 unkB6;
    /* 0xB8 */ char pad_B8[0xDC - 0xB8];
    /* 0xDC */ s32 unkDC;
} Struct_801110CC;

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
s32 ovl_11_func_80111944(s16 arg0);
s32 ovl_11_func_8011184C(s16 arg0);

void ovl_11_func_801110CC(Struct_801110CC *arg0) {
    Recon_ovl_11_func_801110CC_D800BAC04Table local;
    SpriteDataHeader *header;
    s16 temp_a0;
    s32 var_a2;
    s32 var_s0;
    u16 temp_t3;
    char *far_base;

    local = D_800BAC04;
    temp_t3 = arg0->unkB6;
    if (temp_t3 == 0) {
        arg0->unkDC = 0;
        return;
    }
    if (arg0->unkDC != 0) {
        return;
    }
    temp_a0 = arg0->unk30;
    far_base = (char *)&D_8007AFF0;
    if (temp_a0 == *(s16 *)(far_base + 0x25476)) {
        switch (temp_a0) {
        case 1:
            var_s0 = local.entries[D_80070CF2].unk0;
            var_a2 = local.entries[D_80070CF2].unk4((s16)temp_t3);
            break;
        case 4:
        case 5:
            var_a2 = ovl_11_func_80111944((s16)temp_t3);
            var_s0 = 7;
            break;
        case 6:
            var_a2 = ovl_11_func_8011184C((s16)temp_t3);
            var_s0 = 4;
            break;
        default:
            var_a2 = -1;
            var_s0 = 0;
            break;
        }
        if (var_a2 == -1) {
            arg0->unkB6 = 0;
            arg0->unkDC = 0;
            return;
        }
        header = (SpriteDataHeader *)(((s32 *)D_80125528[var_s0])[var_a2 + 1] + (s32)D_800957F8);
        func_80015704((SpriteSourceData *)((u8 *)arg0 + 0xC8), header);
    }
}
