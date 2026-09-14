#include "common.h"
#include "game_types.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

void ovl_11_func_800BD8DC(s16 arg0) {
    D_80128800 = arg0;
    func_80014BCC(0, ((arg0 << 3) - arg0 << 11) + 0x3CB8800, 0x3800, 0, ((s32)(&D_8007BFF8)));
}
