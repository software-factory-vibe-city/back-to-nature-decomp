#include "common.h"
#include "game_types.h"

extern s32 D_80134B14;

void ovl_30_func_8012FDEC(void) {
    if (((SomeStruct *)D_8005E3A8)->field_0x0 & 0x2000) {
        D_80134B14 += 1;
        if (D_80134B14 == 0x100) {
            D_80134B14 = 0;
        }
    }

    if (((SomeStruct *)D_8005E3A8)->field_0x0 & 0x8000) {
        if (D_80134B14 == 0) {
            D_80134B14 = 0x100;
            return;
        }
        D_80134B14 -= 1;
    }
}
