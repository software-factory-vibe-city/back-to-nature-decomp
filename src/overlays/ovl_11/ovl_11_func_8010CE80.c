#include "common.h"
#include "game_types.h"

extern s32 (*D_800BAA84[14])(void *);
extern s32 (*D_800BAABC[14])(void *);

s32 ovl_11_func_8010CE80(Recon_ovl_11_func_8010CE80_A0View *arg0, s32 arg1) {
    s32 var = 0;
    if (D_800BAA84[arg1] != 0) {
        if (arg0->unk26 == arg1 && (arg0->unk34 & 0x800)) {
            var = -1;
        } else {
            var = D_800BAA84[arg1](arg0);
        }
    }
    if (D_800BAABC[arg1] != 0 && var != -1) {
        arg0->unk26 = arg1;
        arg0->unk28 = 0;
        arg0->unk2A = 0;
        arg0->unk2C = 0;
        arg0->unkB8 &= 0xF7FF;
    }
    return var;
}
