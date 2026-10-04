#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D3404(Recon_ovl_11_func_800D3404_A0View *arg0, s32 arg1);

void ovl_11_func_80107DD0(s16 *arg0);

s32 ovl_11_func_800D3390(Recon_ovl_11_func_800D3390_A0View *arg0, s32 arg1) {
    s16 var_s1;

    var_s1 = arg1;
    if (arg0->unk0 != 0) {
        return -1;
    }
    memset(arg0, 0, 0xB0);
    arg0->unk0 = var_s1;
    arg0->unk4 = 0xFFFF;
    ovl_11_func_800D3404((Recon_ovl_11_func_800D3404_A0View *)arg0, var_s1);
    ovl_11_func_80107DD0(&arg0->unkA8);
    return 0;
}
