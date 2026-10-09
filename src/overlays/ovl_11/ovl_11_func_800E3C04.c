#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_11_func_800E7798 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
void func_8001AF70 (u16 arg0, u16 arg1);
s32 ovl_11_func_800E99EC (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
s32 ovl_11_func_800E9620 (s16 arg0, s16 arg1, s32 arg2, s32 arg3);
u16 ovl_11_func_800EAF5C (s16 arg0);

void ovl_11_func_800E3C04(void) {
    u8 *base = (u8 *)D_8006C838;
    (*(s32 *)(base + 0x7A74)) = 2;
    ovl_11_func_800E7798(0, 0, 0, 0);
    (*(s32 *)(base + 0x522C)) = 0;
    (*(s32 *)(base + 0x5230)) = 0;
}
