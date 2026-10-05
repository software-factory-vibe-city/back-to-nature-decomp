#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800C7270(Recon_ovl_11_func_800C7270_A0View *arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_800D7348(u16 *dst, u16 *src);
void func_8001FABC(s16 arg0);

void ovl_11_func_800C4F44(Recon_ovl_11_func_800C7270_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    Recon_ovl_11_func_800C7270_A0View *var_s0;

    if (arg1 == 0) {
        var_s0 = &arg0->unk84;
    } else {
        var_s0 = (Recon_ovl_11_func_800C7270_A0View *) ((u8 *) arg0 + ((arg2 * 6) + 0x90));
    }
    if ((*(s16 *) ((u8 *) var_s0 + 0)) != 0) {
        arg0->unk6C &= 0xE7FFFFFF;
        ovl_11_func_800C7270(arg0, 0x15, 0x47, arg3);
        ovl_11_func_800D7348((u16 *) &arg0->unkF0, (u16 *) var_s0);
        arg0->unk6C |= 0x8000;
        func_8001FABC(7);
    }
}
