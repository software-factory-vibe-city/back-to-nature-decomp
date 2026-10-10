#include "common.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_15_func_80134450(s16 arg0, s16 arg1, s16 arg2);

/* Overlay-local table passed by address to func_80015EE8 (ovl_15 data). */
extern u8 D_801456A0[];

void ovl_15_func_80134134(s16 arg0, s16 arg1, s32 arg2, s16 arg3, s16 arg4, s16 arg5) {
    s32 var_v1;

    arg1 = (arg1 << 0x10) != 0;
    var_v1 = 0;
    if (arg0 == 0x10A) {
        var_v1 = 0xE;
        arg1 = 0;
    }
    if (arg0 == 0x109) {
        var_v1 = 0xF;
    }
    if (arg0 == 0x160) {
        var_v1 = 6;
    }
    if (arg0 == 0x161) {
        var_v1 = 7;
    }
    if (arg0 == 0x162) {
        var_v1 = 8;
    }
    if (arg0 == 0x163) {
        var_v1 = 9;
    }
    if (arg0 == 0x164) {
        var_v1 = 0xA;
    }
    if (arg0 == 0x165) {
        var_v1 = 0xB;
    }
    if (arg0 == 0x166) {
        var_v1 = 0xD;
    }
    func_80015EE8(D_8005E3C0->field_D8 + 4, (s32) &D_801456A0, var_v1, arg1 & 0xFF, (s16) (s32) arg4, (s16) (s32) arg5);
    func_80017B3C(D_8005E3C0->field_D8 + 0x14, arg2, (s32) (s16) (arg4 + 0x18), (s32) arg5);
    ovl_15_func_80134450((s16) (arg3 / 25), (s16) (arg4 + 0x5A), (s16) (arg5 + 0xC));
}
