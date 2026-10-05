#include "common.h"


void SsSeqClose(short);
void SsSeqSetVol(short, short, short);
void SsVabClose(short);
s32 func_80013394(void);
s32 func_8001FE6C(void);
void func_8001FAE8(s32 arg0);
s32 func_8001FBBC(s16 arg0);
s32 func_80020B80(s32 arg0, s32 arg1);
void func_80011EF0(s32 arg0);
s32 func_80021484(s32 arg0);
s32 func_80020414(s32 arg0, s32 arg1);

void ovl_23_func_800B8104(void) {
    s32 *base;
    s32 var_s0;

    var_s0 = func_80013394() == 1;
    if (func_8001FE6C() == 0) {
        var_s0 = (var_s0 + 1) & 0xFF;
    }
    if (var_s0 == 2) {
        if (D_800BFC90 != -1) {
            func_8001FAE8((s32) D_800BFC90);
        }
        func_8001FBBC(0);
        func_80020B80(2, 0);
        func_80020B80(1, 0);
        base = (s32 *)&D_8006C838;
        base[0x448C >> 2] = 0xFF;
        func_80011EF0(6);
        base[0xC >> 2] |= 0x80000;
    }
}
