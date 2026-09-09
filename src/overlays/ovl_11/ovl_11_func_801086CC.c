#include "common.h"
#include "game_types.h"

extern s32 D_8012D040;

s32 ovl_11_func_801086CC(void) {
    s32 mode = ((GfxObj *)D_8005E3A8)->field_8 & 0xF020;

    if (mode == 0x1000) {
        D_8012D040 = 0;
    } else if (mode == 0x8000) {
        D_8012D040 = 2;
    } else if (mode == 0x2000) {
        D_8012D040 = 1;
    } else if (mode == 0x4000) {
        D_8012D040 = 3;
    } else {
        return 0;
    }
    return 1;
}
