#include "common.h"
#include "game_types.h"

void ovl_11_func_800FD194(s32 arg0);

void ovl_11_func_800FD034(s16 arg0, void (*arg1)(s16, s16));

void ovl_11_func_800FCED4(s16 arg0, s16 arg1);

void ovl_11_func_800FCEA0(void) {
    ovl_11_func_800FD194(2);
    ovl_11_func_800FD034(D_8012722A, ovl_11_func_800FCED4);
}
