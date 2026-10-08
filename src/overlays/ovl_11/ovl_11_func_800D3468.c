#include "common.h"
#include "psyq/libapi.h"

typedef struct Unk800D3468 {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u8 pad[0xAA];
    /* 0xAC */ s16 unkAC;
} Unk800D3468;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_800D3104(u16 *arg0, s32 arg1);
s32 ovl_11_func_800D3C04(void *arg0);
s32 ovl_11_func_800D3C54(void *arg0);
s32 ovl_11_func_800D3CA4(void *arg0);
s32 ovl_11_func_800D3CE8(void *arg0);
s32 ovl_11_func_800D3D2C(Unk800D3468 *arg0);

s32 ovl_11_func_800D3468(u16 *arg0) {
    s32 var_s0;

    var_s0 = 0;
    switch (arg0[0]) {
    case 0x154:
        var_s0 = 2;
        break;
    case 0x156:
        var_s0 = 3;
        break;
    case 0x157:
        var_s0 = 4;
        break;
    case 0x15B:
        var_s0 = ovl_11_func_800D3D2C((Unk800D3468 *)arg0);
        break;
    case 0x108:
        if (func_80012A34(2) != 0) {
            var_s0 = 0x11;
        } else {
            var_s0 = 1;
        }
        break;
    case 0x10B:
    case 0x10C:
        var_s0 = ovl_11_func_800D3C04(arg0);
        break;
    case 0x10D:
        var_s0 = ovl_11_func_800D3CA4(arg0);
        break;
    case 0x10E:
        var_s0 = ovl_11_func_800D3C54(arg0);
        break;
    case 0x10F:
        var_s0 = ovl_11_func_800D3CE8(arg0);
        break;
    case 0x112:
    case 0x113:
    case 0x114:
    case 0x115:
    case 0x116:
    case 0x117:
    case 0x118:
    case 0x119:
    case 0x11A:
    case 0x153:
    case 0x155:
        var_s0 = 0;
        break;
    case 0x110:
    case 0x159:
    case 0x162:
    case 0x165:
    case 0x17A:
    case 0x17B:
        var_s0 = 1;
        break;
    default:
        SystemError(0x45, 0x64);
        break;
    }
    ovl_11_func_800D3104(arg0, var_s0);
    return 0;
}
