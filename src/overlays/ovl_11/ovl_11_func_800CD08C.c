#include "common.h"
#include "game_types.h"

void ovl_11_func_800BD168(void);

s32 ovl_11_func_800CB4E0(void);

s32 ovl_11_func_800CD08C(Recon_ovl_11_func_800CD08C_A0View *arg0) {
    s32 callRet3;
    arg0->unk6C = arg0->unk6C & -0x1001;
    ovl_11_func_800BD168();
    callRet3 = ovl_11_func_800CB4E0();
    return callRet3;
}
