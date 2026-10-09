#include "common.h"
#include "game_types.h"

void func_800132F0(s32 arg0, s32 arg1, s32 arg2);

s32 ovl_11_func_800FBE4C(void) {
    if (D_8012720C == 0) {
        D_8012720C = 1;
        func_800132F0(10, 0, 2);
    } else {
        return D_8012720C;
    }
}
