#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);

void ovl_11_func_800C6F6C(Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1) {
    switch (arg0->unk3C) {
    case 1:
        arg1->unk0.unk0_w = 0x36;
        break;
    case 2:
        arg1->unk0.unk0_w = arg0->unk38 + 0x3B;
        break;
    case 4:
        arg1->unk0.unk0_w = arg0->unk38 + 0x3B;
        func_8001B2CC(0, 0);
        break;
    }
    func_80015840((ObjectState *)((u8 *)arg0 + 0x260), arg1->unk0.unk0_b);
}
