#include "common.h"
#include "psyq/stddef.h"

extern s32 (*D_80123DFC[])(s16, s16, s16);
Ovl11D124Entry *ovl_11_func_800DAF60(s32 arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_800D8320(s16 arg0, s16 arg1, s16 arg2) {
    Ovl11D124Entry *temp_v0;
    s16 var_a2;

    temp_v0 = ovl_11_func_800DAF60((s32) arg0, arg1, arg2);
    if (temp_v0 == NULL) {
        return 0;
    }
    if ((((u16) temp_v0->unk2) & 0xFFFF) != 0x16A) {
        if ((((u16) temp_v0->unk2) & 0xFFFF) != 0x168) {
            return 0;
        }
    }
    if (((u16) temp_v0->unk0 == 0x36) && (temp_v0->unk4 != 0)) {
        return 0;
    }
    if ((D_80070CF2 == 3) && (arg0 == 0)) {
        return 0;
    }
    if ((u16) temp_v0->unk2 == 0x168) {
        temp_v0->unk2 = 0x169;
        var_a2 = 2;
    } else {
        temp_v0->unk2 = 0x16B;
        var_a2 = 4;
    }
    D_80123DFC[arg0](arg1, arg2, var_a2);
    return 1;
}
