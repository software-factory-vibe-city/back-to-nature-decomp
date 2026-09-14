#include "common.h"
#include "game_types.h"

void ovl_11_func_800FD194(s32 arg0);

void ovl_11_func_800FD034(s16 arg0, void (*arg1)(s16, s16));

void ovl_11_func_800FCBB4(s16 arg0, s16 arg1);

void ovl_11_func_800FCB80(void) {
    ovl_11_func_800FD194(0);
    ovl_11_func_800FD034(D_80127222, ovl_11_func_800FCBB4);
}
