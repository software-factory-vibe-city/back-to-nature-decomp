#include "common.h"
#include "game_types.h"

void ovl_23_func_800BB0D8(Ovl23Func800BB0C8Arg *arg0, s32 arg1, s32 arg2, s32 arg3);

extern Ovl23D87CView39C D_800BF87C;

void ovl_23_func_800B9A00(Ovl23Func800BB0C8Arg *arg0) {
    s32 temp_a0;
    s32 temp_s0;
    s32 temp_v1;
    s32 temp_v1_2;

    temp_a0 = *(s32 *)((u8 *)arg0 + 0xC);
    temp_s0 = (D_800BF87C.unk39C + 0x77) << 12;
    if (temp_a0 < temp_s0) {
        ovl_23_func_800BB0D8(arg0, 2, 2, 0);
        temp_v1 = (*(s32 *)((u8 *)arg0 + 0xC)) + ((D_800BF87C.unk3A0 << 12) / 10);
        *(s32 *)((u8 *)arg0 + 0xC) = temp_v1;
        if (temp_s0 < temp_v1) {
            *(s32 *)((u8 *)arg0 + 0xC) = temp_s0;
        }
    } else if (temp_s0 < temp_a0) {
        ovl_23_func_800BB0D8(arg0, 2, 6, 0);
        temp_v1_2 = (*(s32 *)((u8 *)arg0 + 0xC)) - ((D_800BF87C.unk3A0 << 12) / 10);
        *(s32 *)((u8 *)arg0 + 0xC) = temp_v1_2;
        if (temp_v1_2 < temp_s0) {
            *(s32 *)((u8 *)arg0 + 0xC) = temp_s0;
        }
    }
    if ((*(s32 *)((u8 *)arg0 + 0xC)) == temp_s0) {
        ovl_23_func_800BB0D8(arg0, 1, 6, 0);
    }
}
