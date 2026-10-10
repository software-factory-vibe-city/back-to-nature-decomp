#include "common.h"
#include "game_types.h"

void ovl_23_func_800BB0C8(Ovl23Func800BB0C8Arg *arg0, s32 arg1, s32 arg2, s32 arg3);

extern Ovl23D87CView39C D_800BF87C;

void ovl_23_func_800B989C(Ovl23Func800BB0C8Arg *arg0) {
    s32 temp_s1;
    s32 temp_s2;
    s32 temp_a0;
    s32 temp_a2;

    temp_s2 = (D_800BF87C.unk3B2 << 0xC) / 10;
    temp_s1 = (D_800BF87C.unk39C + 0x37) << 0xC;
    temp_a0 = *(s32 *)((u8 *)arg0 + 0x14);
    if (temp_a0 < temp_s1) {
        ovl_23_func_800BB0C8(arg0, 1, 2, 0);
        *(s32 *)((u8 *)arg0 + 0x14) += temp_s2;
        if (temp_s1 < *(s32 *)((u8 *)arg0 + 0x14)) {
            *(s32 *)((u8 *)arg0 + 0x14) = temp_s1;
        }
    } else if (temp_s1 < temp_a0) {
        ovl_23_func_800BB0C8(arg0, 1, 6, 0);
        *(s32 *)((u8 *)arg0 + 0x14) -= temp_s2;
        if (*(s32 *)((u8 *)arg0 + 0x14) < temp_s1) {
            *(s32 *)((u8 *)arg0 + 0x14) = temp_s1;
        }
    }
    temp_a2 = *((s16 *)((u8 *)&D_800BBA40 + (*(s16 *)((u8 *)arg0 + 0) * 2))) << 0xC;
    if (*(s32 *)((u8 *)arg0 + 0x18) < temp_a2) {
        *(s32 *)((u8 *)arg0 + 0x18) += temp_s2;
        if (temp_a2 < *(s32 *)((u8 *)arg0 + 0x18)) {
            *(s32 *)((u8 *)arg0 + 0x18) = temp_a2;
        }
    } else if (temp_a2 < *(s32 *)((u8 *)arg0 + 0x18)) {
        *(s32 *)((u8 *)arg0 + 0x18) -= temp_s2;
        if (*(s32 *)((u8 *)arg0 + 0x18) < temp_a2) {
            *(s32 *)((u8 *)arg0 + 0x18) = temp_a2;
        }
    }
    if ((*(s32 *)((u8 *)arg0 + 0x18)) == temp_a2 && (*(s32 *)((u8 *)arg0 + 0x14)) == temp_s1) {
        ovl_23_func_800BB0C8(arg0, 2, 2, 0);
    }
}
