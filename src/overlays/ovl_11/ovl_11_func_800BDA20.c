#include "common.h"
#include "game_types.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

void func_8001719C(u8 *arg0);

void ovl_11_func_800BDA20(void) {
    func_80014BCC(0, 0x3D51000, 0x6800, 0, D_8005E3B0 + 0x4290);
    func_8001719C(((void *)(D_8005E3B0 + 0x4290)));
}
