#include "common.h"
#include "game_types.h"

void ovl_17_func_800B90F8(void) {
    s16 i;

    for (i = 0; i < 90; i++) {
        ((Ovl17QueueView *)D_800BD848)->entries[i].word = -0x20000;
        ((Ovl17QueueView *)D_800BD848)->entries[i].field = -1;
        if (i < 6) {
            ((Ovl17QueueView *)D_800BD848)->entries[i].field = i * 0x1A + 0x4D;
        }
    }
    ((Ovl17QueueView *)D_800BD848)->cursor = 6;
}
