#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ s8 unk2;
    /* 0x03 */ char pad3;
} M2C_Elem801032BC;

typedef struct {
    /* 0x00 */ char pad0[0x1C];
    /* 0x1C */ M2C_Elem801032BC *unk1C;
} M2C_Arg801032BC;

s32 ovl_11_func_801032BC(M2C_Arg801032BC *arg0, s32 arg1, u16 *arg2) {
    s32 var_t0;
    s32 var_t1;
    s32 var_v0;

    switch (arg1 & 0xFFFF) {
    case 0xE8:
    case 0x122:
    case 0x123:
    case 0x124:
        var_t1 = 0x181;
        break;
    case 0x8E:
    case 0x8F:
    case 0x90:
        var_t1 = 0x182;
        break;
    case 0xE4:
        var_t1 = 0x182;
        break;
    case 0xE3:
        var_t1 = 0x183;
        break;
    case 0x8B:
    case 0x8C:
    case 0x8D:
        var_t1 = 0x183;
        break;
    case 0x88:
    case 0x89:
    case 0x8A:
        var_t1 = 0x184;
        break;
    case 0xE5:
        var_t1 = 0x184;
        break;
    default:
        return 0;
    }

    for (var_t0 = 0; arg0->unk1C[var_t0].unk0 != 0; var_t0++) {
        if (arg0->unk1C[var_t0].unk0 == var_t1) {
            *arg2 += arg0->unk1C[var_t0].unk2;
            break;
        }
    }
    var_v0 = 2;
    if (arg0->unk1C[var_t0].unk0 != 0) {
        var_v0 = 1;
    }
    return var_v0;
}
