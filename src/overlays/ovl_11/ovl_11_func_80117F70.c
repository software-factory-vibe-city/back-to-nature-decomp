#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_11_func_801186FC (void);
void ovl_11_func_8011D400 (s32 *arg0);
s32 ovl_11_func_800D6014 (u16 arg0);

s32 ovl_11_func_80117F70(void) {
    s32 temp_v0;
    s32 var_s4;

    temp_v0 = ovl_11_func_801186FC();
    D_8012D7D4 = temp_v0;
    var_s4 = 4;
    if (temp_v0 != -1) {
        var_s4 = temp_v0;
    }
    ovl_11_func_8011D400((s32 *) D_8012D548);
    (*(s16 *) ((u8 *) D_8012D548 + 0x28)) = 0;
    (*(s8 *) ((u8 *) D_8012D548 + 0x3C)) = 1;
    (*(s16 *) ((u8 *) D_8012D548 + 0x46)) = 0x133;
    (*(s8 *) ((u8 *) D_8012D548 + 0x3D)) = 1;
    (*(s16 *) ((u8 *) D_8012D548 + 0x48)) = (s16) (var_s4 + 0x134);
    (*(s8 *) ((u8 *) D_8012D548 + 0x5A)) = 0x11;
    (*(s8 *) ((u8 *) D_8012D548 + 0x5B)) = 0x11;
    (*(s16 *) ((u8 *) D_8012D548 + 0x2A)) = 0;
    (*(s16 *) ((u8 *) D_8012D548 + 0x5C)) = 0;
    D_8012D7D8.unk8 = 2;
    D_8012D7D8.unkA = 0x139;
    D_8012D7D8.unkC = 2;
    D_8012D7D8.unk4 = -1;
    D_8012D7D8.unk6 = -1;
    D_8012D7D8.unkE = 0x141;
    D_8012D7D8.unk10 = 4;
    D_8012D7D8.unk0 = D_8012D548;
    (*(void **) ((u8 *) D_8012D548 + 0)) = (void *) ((u8 *) &D_80051D34 + *D_80054BC0);
    (*(void **) ((u8 *) D_8012D548 + 4)) = (void *) ((u8 *) ((u8 *) &D_80051D34 - 0x5D8) + (*D_80054BC0 + D_80128264[var_s4]));
    D_8012D538.unk4 = (void *) ((u8 *) &D_80051D34 + 0x98 + *D_80054BC0);
    D_8012D538.unkA = ovl_11_func_800D6014(0x3FU);
    D_8012D538.unk8 = 1;
    ovl_11_func_8011D400((s32 *) D_8012D5A8);
    (*(s16 *) ((u8 *) D_8012D5A8 + 0x46)) = 0x133;
    (*(s16 *) ((u8 *) D_8012D5A8 + 0x28)) = 0x3F;
    (*(s8 *) ((u8 *) D_8012D5A8 + 0x3C)) = 1;
    (*(s16 *) ((u8 *) D_8012D5A8 + 0x5C)) = 0;
    D_8012D52C = 0;
    D_8012D7CC = 0;
    D_8012D7D0 = 8;
    return 1;
}
