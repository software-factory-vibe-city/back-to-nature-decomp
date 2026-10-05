#include "common.h"
#include "game_types.h"

void func_8001FABC(s16 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 ovl_11_func_800C7270(Recon_ovl_11_func_800C7270_A0View *arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800C8764(Recon_ovl_11_func_800C8334_A0View *arg0) {
    ItemData *item;
    s32 var_a2;

    if (arg0->unk8A == 0) {
        func_8002261C(2, 0x20A);
        return;
    }
    item = &D_8006C858[arg0->unk8A];
    var_a2 = 0;
    if (((item->u0.flags & 0x9000) == 0x9000) || ((*(s32 *) ((u8 *) item + 0x14)) == -1)) {
        var_a2 = 1;
    }
    if (var_a2 != 0) {
        ovl_11_func_800C7270((Recon_ovl_11_func_800C7270_A0View *)arg0, 0x61, arg0->unk38 + 0x17, -2);
        func_8001FABC(9);
    }
}
