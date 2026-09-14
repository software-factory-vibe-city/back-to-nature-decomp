#include "common.h"
#include "game_types.h"

s32 func_80013394(void);

void ovl_11_func_800C70CC(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800C97D0(Recon_ovl_11_func_800C97D0_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet3;
    if ((D_8006C844 & 0x8000000) == 0) {
        callRet3 = func_80013394();
        if (callRet3 == 0) {
            return 0;
        } else {
            if ((arg0->unk6C & 0x18000000) == 0) {
                if (arg0->unk1A < 0x65) {
                    return 0;
                } else {
                    if ((arg0->unk6C & 0x400000) == 0) {
                        arg0->unk6C = arg0->unk6C | 0x1800;
                        ovl_11_func_800C70CC(((s32)arg0), 0x54, 0, -2);
                        arg0->unk6C = arg0->unk6C | 0x400000;
                        return 1;
                    } else {
                        return 0;
                    }
                }
            } else {
                return 0;
            }
        }
    } else {
        return 0;
    }
}
