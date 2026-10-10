#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800E8F78(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 var_a1;
    s32 var_a2;
    s32 var_t2;
    s16 var_v1;
    char *base;
    s32 *p;

    var_a2 = arg2;
    if (arg3 & 1) {
        var_a2 = D_80129560[var_a2];
    }
    if (arg3 & 2) {
        var_a1 = D_80129560[arg1];
    } else {
        var_a1 = arg1;
    }
    p = D_80071B00;
    base = (char *)(p - 0x14B2);
    var_t2 = 0;
    var_v1 = arg0 % 2;
    *(s32 *)(base + 0x5234) |= 2;
    switch (var_a1) {
    case 0:
        if (!(var_a2 < p[2])) {
            p[2] = var_a2;
            var_t2 = 1;
        } else {
            s32 var_v0 = 0x4000;
            *(s32 *)(base + 0x522C) = var_v0;
            *(s32 *)(base + 0x5230) = var_v0;
        }
        break;
    case 1:
        if (!(var_a2 < p[0])) {
            p[0] = var_a2;
            var_t2 = 1;
        } else {
            s32 var_v0 = 0x8000;
            *(s32 *)(base + 0x522C) = var_v0;
            *(s32 *)(base + 0x5230) = var_v0;
        }
        break;
    case 2:
        if (!(p[2] < var_a2)) {
            p[2] = var_a2;
            var_t2 = 1;
        } else {
            s32 var_v0 = 0x1000;
            *(s32 *)(base + 0x522C) = var_v0;
            *(s32 *)(base + 0x5230) = var_v0;
        }
        break;
    case 3:
        if (!(p[0] < var_a2)) {
            p[0] = var_a2;
            var_t2 = 1;
        } else {
            s32 var_v0 = 0x2000;
            *(s32 *)(base + 0x522C) = var_v0;
            *(s32 *)(base + 0x5230) = var_v0;
        }
        break;
    }
    if (var_t2 == 1) {
        ((struct struct_8006C838_800E8F78 *) &D_8006C838)->field_5234 &= ~2;
    } else if (var_v1 != 0) {
        ((struct struct_8006C838_800E8F78 *) &D_8006C838)->field_522C |= 0x40;
        ((struct struct_8006C838_800E8F78 *) &D_8006C838)->field_5230 |= 0x40;
    }
    return var_t2;
}
