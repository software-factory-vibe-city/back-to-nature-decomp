#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_8001AF70 (u16 arg0, u16 arg1);
s32 ovl_11_func_800E99EC (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800E9620 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
u16 ovl_11_func_800EAF5C (s16 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_800F1038 (u16 arg0, s32 arg1);
void ovl_11_func_800C08E8 (s32 arg0);
s32 ovl_11_func_800F1354 (s32 arg0, s32 arg1);

struct struct_8006C838_800E7798 {
    char pad_000[0x4450];
    s32 field_4450;
    char pad_4454[0x5234 - 0x4454];
    s32 field_5234;
    char pad_5238[0x7A74 - 0x5238];
    s32 field_7A74;
};

s32 ovl_11_func_800E7798(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 var_v0;

    switch (arg0) {
    case 1: {
        char *far_base = (char *)&D_8007AFF0;

        (*(s32 *)(far_base + 0x254A0)) = 0xC;
        ((struct struct_8006C838_800E7798 *)D_8006C838)->field_5234 |= 0x400;
        func_8001AF70(0x47U, 1U);
        break;
    }
    case 2:
        ovl_11_func_800E99EC(arg1, 0, 1, 0);
        break;
    case 3:
        ovl_11_func_800E99EC(arg1, 0, 0, 0);
        break;
    default:
        break;
    }
    var_v0 = arg3 & 2;
    if (var_v0 != 0) {
        ovl_11_func_800E9620(0x2A, 2, 0, 0);
    }
    ovl_11_func_800EAF5C(2, arg3 & 1, 0, 0);
    if (arg2 != 0) {
        ((struct struct_8006C838_800E7798 *)D_8006C838)->field_4450 |= 8;
    }
    ((struct struct_8006C838_800E7798 *)D_8006C838)->field_7A74 = 2;
    return 1;
}
