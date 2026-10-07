#include "common.h"
#include "game_types.h"

extern u16 D_80070CF8;
extern s32 (*D_800BAABC[14])(void *);

s32 ovl_11_func_8010D250(Recon_ovl_11_func_8010D250_A0View *arg0);
s32 ovl_11_func_8010CE80(Recon_ovl_11_func_8010CE80_A0View *arg0, s32 arg1);

s32 ovl_11_func_8010CD80(Recon_ovl_11_func_8010D250_A0View *arg0) {
    s32 (*temp_v0)(void *);

    temp_v0 = D_800BAABC[(u16) arg0->unk26];
    if (temp_v0 != 0) {
        temp_v0(arg0);
    }
    if (!((*(s32 *) ((u8 *) arg0 + 0x34)) & 0x800) && (arg0->unk2C >= 0x12C)) {
        ovl_11_func_8010D250(arg0);
        arg0->unk2C = 0;
    }
    if ((arg0->unk30 != 0x28) && ((u32) (D_80070CF8 - 6) >= 0xFU) && (arg0->unk26 != 0xC) && ((*(u16 *) ((u8 *) arg0 + 0xB6)) == 0)) {
        arg0->unkBE = 0;
        (*(u16 *) ((u8 *) arg0 + 0xB8)) = (u16) ((*(u16 *) ((u8 *) arg0 + 0xB8)) | 0x40);
        (*(s32 *) ((u8 *) arg0 + 0x34)) = (s32) ((*(s32 *) ((u8 *) arg0 + 0x34)) & ~0x800);
        ovl_11_func_8010CE80((Recon_ovl_11_func_8010CE80_A0View *) arg0, 0xC);
    }
    arg0->unk2C = (u16) arg0->unk2C + 1;
    return 0;
}
