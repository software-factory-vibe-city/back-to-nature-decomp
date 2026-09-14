#include "common.h"
#include "game_types.h"

void func_800249C0(s32 arg0, s16 arg1, s16 arg2);

void func_8001FABC(s16 arg0);

s32 ovl_15_func_80137228(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    func_800249C0(D_8005E3C0->field_D8 + 4, 0x11D, 0xD9);
    if (((GfxObj *)D_8005E3A8)->field_8 == 0) {
        return arg0;
    } else {
        func_8001FABC(0);
        return arg1;
    }
}
