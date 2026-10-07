#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2);

s32 ovl_11_func_800E2824(u16 *arg0, s32 arg1) {
    s32 var_s2;

    var_s2 = 0;
    if (D_800B96BC[arg1] != 0) {
        if ((*((s16 *) ((u8 *) arg0 + 0x26)) == arg1) && (*((s32 *) ((u8 *) arg0 + 0x34)) & 0x800)) {
            var_s2 = -1;
        } else {
            var_s2 = D_800B96BC[arg1](arg0);
        }
    }
    if ((D_800B970C[arg1] != 0) && (var_s2 != -1)) {
        *((s16 *) ((u8 *) arg0 + 0x26)) = arg1;
        *((s16 *) ((u8 *) arg0 + 0x28)) = 0;
        *((s16 *) ((u8 *) arg0 + 0x2A)) = 0;
        *((s16 *) ((u8 *) arg0 + 0x2C)) = 0;
        ovl_11_func_800D0408(4, (Recon800D0408A1View *) ((u8 *) arg0 + 0x48), 0);
    }
    return var_s2;
}
