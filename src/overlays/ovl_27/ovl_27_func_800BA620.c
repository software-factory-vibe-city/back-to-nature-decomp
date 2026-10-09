#include "common.h"
#include "psyq/memory.h"

u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);
void func_8001719C(u8 *arg0);

s32 ovl_27_func_800BA620(void) {
    if (func_80014CBC(0, 0x25000, 0x5800, (u8 *)(D_8005E3B0 + 0x4290), 1, 0) == 0) {
        return 0;
    }
    func_8001719C((u8 *)(D_8005E3B0 + 0x566C));
    memcpy(&D_800977F8, (void *)(D_8005E3B0 + 0x4290), 0x13DC);
    return 1;
}
