#include "common.h"
#include "game_types.h"

void ovl_11_func_8011FF74(void *arg0, s16 arg1);

void ovl_11_func_8011FDCC(s16 arg0) {
    s32 i;

    for (i = 0; i < (((Ovl11Status99C8View *)&D_8006C838)->field_44D2 == 0 ? 5 : 10); i++) {
        ovl_11_func_8011FF74((u8 *)&D_800742EC + i * 0xB4, arg0);
    }
    for (i = 0; i < (((Ovl11Status99C8View *)&D_8006C838)->field_44D0 == 0 ? 10 : 20); i++) {
        ovl_11_func_8011FF74((u8 *)&D_800749F4 + i * 0xB8, arg0);
    }
}
