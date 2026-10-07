#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
    char data[0x524C];
    s16 field_524C;
    s16 field_524E;
    char pad_1[0x2];
    s16 field_5252;
    s16 field_5254;
} StoreView;

s32 ovl_11_func_8011DF04 (s16 arg0);
s16 ovl_11_func_8011DEBC (s16 arg0, s32 arg1);

s32 ovl_11_func_8011DD90(void) {
    StoreView *view;
    s16 temp_a0;
    s16 temp_s0;
    s32 temp_s1;
    s32 temp_v0;
    u16 temp_s0_2;

    view = (StoreView *)&D_8006C838;
    temp_a0 = view->field_5252;
    if ((u32) (((view->field_524C) - 1) & 0xFFFF) >= 0x19U) {
        return 1;
    }
    temp_s1 = ((view->field_524C) - 1) / 5;
    temp_s0 = ((view->field_524C) - 1) % 5;
    temp_a0 = ovl_11_func_8011DF04(temp_a0);
    if (temp_s0 == 4) {
        return 2;
    }
    temp_v0 = temp_a0 < temp_s0;
    if (temp_v0 != 0) {
        return 3;
    }
    if (temp_s0 == temp_a0) {
        return 4;
    }
    temp_s0_2 = *(u16 *) ((u8 *) &D_8006C838->data[((temp_s1 << 0x10) >> 0xF)] + 0x5208);
    if ((s32) temp_s0_2 < ovl_11_func_8011DEBC(temp_a0, 0)) {
        return 5;
    }
    return 0;
}
