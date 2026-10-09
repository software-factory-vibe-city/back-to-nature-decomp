#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);

void ovl_11_func_800C6F0C(Recon_ovl_11_func_800C6F0C_A0View *arg0, Recon_ovl_11_func_800C6F0C_A1View *arg1) {
    switch (arg0->unk3C) {
    case 2:
        arg1->unk0.unk0_w = arg0->unk38 + 0xAC;
        break;
    case 4:
        arg0->unk3C = 2;
        arg1->unk0.unk0_w = arg0->unk38 + 0xAC;
        break;
    }
    func_80015840((ObjectState *)((u8 *)arg0 + 0x260), arg1->unk0.unk0_b);
}
