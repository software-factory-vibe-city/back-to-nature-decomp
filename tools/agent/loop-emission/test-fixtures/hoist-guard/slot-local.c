#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"

void ovl_11_func_800D666C(s16 arg0);

typedef struct {
    char pad_000[0x524C];
    u16 field_524C;
    char pad_524E[4];
    u16 field_5252;
} Ovl11F9BE4View;


typedef struct {
    u16 id;
    u16 unk2;
    u16 unk4;
} ItemSlot;

typedef struct {
    char pad_000[0x524C];
    ItemSlot slots[18];
} ItemView;
void ovl_11_func_800F9BE4(void) {
    ItemView *base;
    Ovl11F9BE4View *view;
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
    base = (ItemView *) D_8006C838;
    for (var_v1 = 0; var_v1 < 0x12; var_v1++) {
        if (var_v1 < 8) {
            sp10[var_v1] = base->slots[var_v1 + 2].id;
        } else if (var_v1 == 8) {
            sp10[var_v1] = base->slots[0].id;
        } else if (var_v1 < 17) {
            sp10[var_v1] = base->slots[var_v1 + 1].id;
        } else if (var_v1 == 17) {
            sp10[var_v1] = base->slots[1].id;
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
