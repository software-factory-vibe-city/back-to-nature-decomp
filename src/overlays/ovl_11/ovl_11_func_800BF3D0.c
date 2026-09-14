#include "common.h"
#include "game_types.h"

void *func_8001EF98(void);

s32 ovl_11_func_800BF3D0(void) {
    Recon_ovl_11_func_800BF3D0_CallRet1View * callRet1;
    callRet1 = func_8001EF98();
    return ((u32)callRet1->unk0) >> 7;
}
