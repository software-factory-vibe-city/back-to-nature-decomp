#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800C11C4(s32 arg0) {
    s16 v;
    u32 i;

    v = arg0;
    for (i = 0; i < 4; i++) {
        func_8001AF70((u16)(i + 0x17), 0);
    }
    func_8001AF70((u16)(v + 0x17), 1);
}
