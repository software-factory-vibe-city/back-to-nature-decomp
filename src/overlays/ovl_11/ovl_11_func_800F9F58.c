#include "common.h"
#include "game_types.h"

s32 func_800226B0(void);
void func_80022738(void);
s32 func_8001FABC(s16 arg0);
void ovl_11_func_800F6640(void);

void ovl_11_func_800F9F58(void) {
    s32 flags;

    if (func_800226B0() != 0) {
        flags = ((GfxObj *)D_8005E3A8)->field_8;
        if (flags & 0x50) {
            func_80022738();
            func_8001FABC(0);
            D_80126F80 = 0;
            return;
        }
        if (flags & 0x20) {
            if (D_80126F88 == 1) {
                ovl_11_func_800F6640();
            }
            func_80022738();
            D_80126F7C = 2;
            func_8001FABC(3);
        }
    }
}
