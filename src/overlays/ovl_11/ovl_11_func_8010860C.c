#include "common.h"
#include "game_types.h"

void func_80022738(void);

extern s32 D_8012D040;
extern s32 D_8012D044;

void ovl_11_func_8010860C(void) {
    s32 mode;
    s32 var_v1;

    mode = ((GfxObj *)D_8005E3A8)->field_8 & 0xF020;
    if (mode == 0) {
        return;
    }
    if (mode == 0x20) {
        D_8012D044 = 6;
        func_80022738();
        return;
    }
    if (mode == 0x1000) {
        var_v1 = 0;
    } else if (mode == 0x8000) {
        var_v1 = 2;
    } else if (mode == 0x2000) {
        var_v1 = 1;
    } else if (mode == 0x4000) {
        var_v1 = 3;
    } else {
        var_v1 = D_8012D040;
    }
    if (D_8012D040 != var_v1) {
        D_8012D040 = var_v1;
        func_80022738();
        D_8012D044 = 2;
    }
}
