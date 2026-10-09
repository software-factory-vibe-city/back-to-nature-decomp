#include "common.h"
#include "game_types.h"

s32 func_8001FABC(s16 arg0);

s32 ovl_11_func_8011CF40(s16 arg0, u16 *arg1) {
    s32 temp_a1;
    s32 temp_v1;
    s32 var_s1;
    u16 var_v0;

    var_s1 = 0;
    temp_a1 = ((SomeStruct *)D_8005E3A8)->field_0x0;
    temp_v1 = ((SomeStruct *)D_8005E3A8)->field_0x8;
    if (temp_a1 & 0x2000) {
        var_v0 = *arg1 + 1;
        *arg1 = var_v0;
        func_8001FABC(5);
    } else if (temp_a1 & 0x8000) {
        var_v0 = *arg1 - 1;
        *arg1 = var_v0;
        func_8001FABC(5);
    } else if (temp_a1 & 0x1000) {
        var_v0 = *arg1 + 0xA;
        *arg1 = var_v0;
        func_8001FABC(5);
    } else if (temp_a1 & 0x4000) {
        var_v0 = *arg1 - 0xA;
        *arg1 = var_v0;
        func_8001FABC(5);
    } else if (temp_v1 & 0x40) {
        var_s1 = 1;
        func_8001FABC(0);
    } else if (temp_v1 & 0x10) {
        var_s1 = 2;
        func_8001FABC(0);
    } else if (temp_v1 & 0x20) {
        var_s1 = 3;
        func_8001FABC(1);
    }
    if (arg0 < (s16) *arg1) {
        *arg1 = 1;
    }
    if ((s16) *arg1 <= 0) {
        *arg1 = (u16) arg0;
    }
    return var_s1;
}
