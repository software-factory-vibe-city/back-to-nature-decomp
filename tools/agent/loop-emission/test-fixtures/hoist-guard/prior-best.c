#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"
typedef struct {
    char pad_000[0x524C];
    u16 field_524C;
    char pad_524E[4];
    u16 field_5252;
} Ovl11F9BE4View;

void ovl_11_func_800D666C(s16 arg0);

void ovl_11_func_800F9BE4(void) {
    Ovl11F9BE4View *base;
    char *far_base;
    s16 sp10[36];
    s16 *src;
    u16 *tbl;
    s16 *q;
    s16 temp_v1;
    s16 var_a0_2;
    s32 temp_s0;
    s32 var_a1_2;
    s32 var_v1;

    base = (Ovl11F9BE4View *) D_8006C838;
    var_v1 = 0;
    tbl = (u16 *) ((u8 *) D_8006C838 + 0x5252);
    do {
        if (var_v1 < 8) {
            sp10[var_v1] = tbl[var_v1 * 3 + 3];
        } else if (var_v1 == 8) {
            sp10[8] = base->field_524C;
        } else if (var_v1 < 17) {
            sp10[var_v1] = tbl[var_v1 * 3];
        } else if (var_v1 == 17) {
            sp10[17] = base->field_5252;
        }
        var_v1 += 1;
    } while (var_v1 < 0x12);
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
