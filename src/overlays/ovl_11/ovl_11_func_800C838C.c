#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D756C(s16 arg0);
s32 ovl_11_func_800C7270(Recon_ovl_11_func_800C7270_A0View *arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800C838C(Recon_ovl_11_func_800C8334_A0View *arg0, s16 *arg1) {
    s32 temp_a2;

    if (ovl_11_func_800D756C(arg0->unk8A) != 0) {
        temp_a2 = arg0->unk38;
        if (temp_a2 == arg1[4]) {
            ovl_11_func_800C7270((Recon_ovl_11_func_800C7270_A0View *)arg0, 0x5A, temp_a2 + 0x17, -2);
        }
    } else {
        func_8002261C(2, 0x1A4);
    }
}
