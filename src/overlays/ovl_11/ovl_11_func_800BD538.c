#include "common.h"

extern s32 D_8005E3B0;
extern s32 D_8009A3F8;

void ovl_11_func_800BD538(void) {
    func_80014BCC(0, 0x0380B000, 0x5000, 0, D_8005E3B0 + 0x4290);
    ovl_11_func_800DD21C(&D_8009A3F8, D_8005E3B0 + 0x4290, 0x540U);
    func_8001719C(D_8005E3B0 + 0x5790);
}
