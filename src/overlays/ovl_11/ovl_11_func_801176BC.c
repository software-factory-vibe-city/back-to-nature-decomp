#include "common.h"

extern u16 D_8012824C[];
s32 ovl_11_func_800D6014(u16 arg0);
s32 ovl_11_func_800F2354(s32 arg0, s32 arg1);

/* Byte-cell view of D_8006C838: the per-id enable flags live at +0xE7A2. */
typedef struct {
    char pad_00[0xE7A2];
    s8 field_E7A2[8];
} M2C_ovl11_801176BC_E7A2;

s32 ovl_11_func_801176BC(u32 arg0) {
    s32 temp_v0;
    u8 *base;

    if ((arg0 >= 9U) || (temp_v0 = ovl_11_func_800D6014(D_8012824C[arg0]), base = (u8 *)D_8006C838, (*(s32 *)(base + 0x5224) < temp_v0) != 0)) {
        return 0;
    }
    ovl_11_func_800F2354(-temp_v0, 1);
    ((M2C_ovl11_801176BC_E7A2 *)base)->field_E7A2[arg0] = 3;
    func_8001AF70((arg0 + 0x67) & 0xFFFF, 1U);
    return 1;
}
