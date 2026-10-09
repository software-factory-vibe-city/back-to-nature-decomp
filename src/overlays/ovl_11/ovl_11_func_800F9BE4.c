#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"

void ovl_11_func_800D666C(s16 arg0);

void ovl_11_func_800F9BE4(void) {
    Ovl11Slots524CView *base;
    char *far_base;
    s16 sp10[36];
    s16 *src;
    s16 *q;
    s16 temp_v1;
    s16 var_a0_2;
    s32 var_a1_2;
    s32 var_v1;

    base = (Ovl11Slots524CView *) D_8006C838;
    for (var_v1 = 0; var_v1 < 0x12; var_v1++) {
        if (var_v1 < 8) {
            sp10[var_v1] = base->slots[var_v1 + 2].unk0;
        } else if (var_v1 == 8) {
            sp10[var_v1] = ((Ovl11Slots524CView *) D_8006C838)->slots[0].unk0;
        } else if (var_v1 < 17) {
            sp10[var_v1] = base->slots[var_v1 + 1].unk0;
        } else if (var_v1 == 17) {
            sp10[var_v1] = ((Ovl11Slots524CView *) D_8006C838)->slots[1].unk0;
        }
    }
    var_v1 = 0;
    far_base = (char *) D_8009AFF0;
    src = (s16 *) (far_base + 0x54A4);
    do {
        q = src + var_v1;
        var_a0_2 = *q;
        if (var_a0_2 != 0) {
            for (var_a1_2 = 0; var_a1_2 < 0x12; var_a1_2++) {
                temp_v1 = sp10[var_a1_2];
                if (temp_v1 != 0 && var_a0_2 == temp_v1) {
                    var_a0_2 = 0;
                    sp10[var_a1_2] = 0;
                    break;
                }
            }
            if (var_a0_2 != 0) {
                ovl_11_func_800D666C(var_a0_2);
            }
        }
        var_v1 += 1;
    } while (var_v1 < 0x12);
}
