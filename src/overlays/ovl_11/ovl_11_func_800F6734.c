#include "common.h"
#include "game_types.h"

void ovl_11_func_800F6680(void);

void func_8001AF70(u16 arg0, u16 arg1);

void func_8001B2CC(s32 arg0, s32 arg1);

void ovl_11_func_800F6734(void) {
    ovl_11_func_800F6680();
    D_80126E40 = 7;
    func_8001AF70(0x70, 1);
    func_8001B2CC(0, 2);
}
