#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
               char pad0[0x38];
               u16 unk38;
               char pad3A[0x100 - 0x3A];
                s32 unk100;
                s32 unk104;
                s32 unk108;
} M2C_ad72053e5aa9_StructOvl11CE034A;

typedef struct {
               s32 unk0;
               s32 unk4;
               s32 unk8;
} M2C_ad72053e5aa9_StructOvl11CE034B;

void ovl_11_func_800CE034 (M2C_ad72053e5aa9_StructOvl11CE034A *arg0, M2C_ad72053e5aa9_StructOvl11CE034B *arg1, s32 arg2);
s32 ovl_11_func_800D7EF8 (s32 *arg0, u16 *arg1, u16 *arg2);
s32 ovl_11_func_8011E090 (VECTOR *pos, u16 *colOut, u16 *rowOut);

s32 ovl_11_func_800CB730(M2C_ad72053e5aa9_StructOvl11CE034A *arg0) {
    M2C_ad72053e5aa9_StructOvl11CE034B sp10;
    u16 sp20;
    u16 sp22;
    u16 temp_a1;
    s16 *base;
    s16 field;

    ovl_11_func_800CE034(arg0, &sp10, 0);
    D_80128C60 = NULL;
    base = (s16 *) &D_8007AFF0;
    field = base[0x12A3B];
    if (field == 1) {
        if (ovl_11_func_800D7EF8(&sp10.unk0, &sp20, &sp22) != 0) {
            return 3;
        }
        D_80128C60 = (u16 *) &D_80071DFC[(s16) sp22][(s16) sp20];
        goto block_8;
    }
    if (field == 6) {
        if (ovl_11_func_8011E090((VECTOR *) &sp10, &sp20, &sp22) != 0) {
            goto ret3;
        }
        goto body6;
    }
    goto block_8;
ret3:
    return 3;
body6:
    D_80128C60 = (u16 *) &D_80074124[(s16) sp22][(s16) sp20];
block_8:
    if (D_80128C60 != NULL) {
        temp_a1 = *D_80128C60;
        if ((u32) (temp_a1 - 0x167) >= 3U && temp_a1 != 0) {
            return 2;
        }
        return 0;
    }
    goto ret3;
}
