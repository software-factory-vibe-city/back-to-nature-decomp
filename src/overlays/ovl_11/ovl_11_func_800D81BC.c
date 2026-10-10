#include "common.h"
#include "psyq/stddef.h"

extern s32 (*D_80123DFC[])(s16, s16, s16);
Ovl11D124Entry *ovl_11_func_800DAF60(s32 arg0, s16 arg1, s16 arg2);
s32 ovl_11_func_800D5868(s16 arg0);
s32 func_80012A34(s32 arg0);

s32 ovl_11_func_800D81BC(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    Ovl11D124Entry *temp_v0;
    s16 var_s5;

    temp_v0 = ovl_11_func_800DAF60((s32) arg0, arg1, arg2);
    if (temp_v0 == NULL) {
        return 0;
    }
    if (((u32) (u16) temp_v0->unk0 - 0x168) >= 2) {
        return 0;
    }
    if (ovl_11_func_800D5868(arg3) == 0) {
        return 0;
    }
    if ((D_80070CF2 == 3) && (arg0 == 0)) {
        return 0;
    }
    if ((u16) temp_v0->unk2 == 0x168) {
        temp_v0->unk2 = 0x16A;
        var_s5 = 3;
    } else {
        temp_v0->unk2 = 0x16B;
        var_s5 = 4;
    }
    if (arg3 == 0x33) {
        if (func_80012A34(0x19) == 0) {
            temp_v0->unk0 = 0x179;
        } else {
            temp_v0->unk0 = 0x178;
        }
    } else {
        temp_v0->unk0 = arg3;
    }
    temp_v0->unk4 = 0;
    temp_v0->unk5 = 0;
    temp_v0->unk6 = (u16) temp_v0->unk6 & 0x7FFF;
    D_80123DFC[arg0](arg1, arg2, var_s5);
    return 1;
}
