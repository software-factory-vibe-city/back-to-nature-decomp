#include "common.h"

typedef struct {
    s16 unk0;
    u16 unk2;
} Recon80110838A0View;

s32 ovl_11_func_801108F8(Recon80110838A0View *arg0);

s32 ovl_11_func_80110838(Recon80110838A0View *arg0) {
    s32 callRet;
    s32 var_v1;

    callRet = ovl_11_func_801108F8(arg0);
    if (callRet != 0) {
        var_v1 = 0;
        if (arg0->unk2 == 0x168) {
            var_v1 = 1;
        } else if (arg0->unk2 == 0x16A) {
            var_v1 = 1;
        }
        return var_v1;
    }
    return 0;
}
