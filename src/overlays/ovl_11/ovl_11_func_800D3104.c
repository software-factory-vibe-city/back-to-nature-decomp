#include "common.h"
#include "game_types.h"

extern s32 D_800B8EC0[];
extern s32 (*D_800B8E6C[])(u16 *);

s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2);

s32 ovl_11_func_800D3104(u16 *arg0, s32 arg1) {
    s32 var_s2;

    var_s2 = 0;
    if (D_800B8E6C[arg1] != 0) {
        if (*(s16 *) ((u8 *) arg0 + 0x26) == arg1) {
            if (!(*(s32 *) ((u8 *) arg0 + 0x34) & 0x800) || (var_s2 = -1, arg1 == 6)) {
                goto block_5;
            }
        } else {
block_5:
            var_s2 = D_800B8E6C[arg1](arg0);
        }
    }
    if (D_800B8EC0[arg1] != 0 && var_s2 != -1) {
        *(s16 *) ((u8 *) arg0 + 0x26) = arg1;
        *(s16 *) ((u8 *) arg0 + 0x28) = 0;
        *(s16 *) ((u8 *) arg0 + 0x2A) = 0;
        *(s16 *) ((u8 *) arg0 + 0x2C) = 0;
        ovl_11_func_800D0408(4, (Recon800D0408A1View *) ((u8 *) arg0 + 0x48), 0);
    }
    return var_s2;
}
