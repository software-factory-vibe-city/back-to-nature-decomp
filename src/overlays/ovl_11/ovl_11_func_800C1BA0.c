#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void ovl_11_func_800C1CBC (s32 arg0);
void ovl_11_func_800F0C70 (void);
void ovl_11_func_800C1C5C (s32 arg0);
void ovl_11_func_80107DD0 (s16 *arg0);
s32 ovl_11_func_800C3548 (s32 arg0);

void ovl_11_func_800C1BA0(void) {
    s32 var_s0;

    var_s0 = 0;
    do {
        ovl_11_func_800C1CBC(var_s0);
        var_s0 += 1;
    } while (var_s0 < 0x25);
    ovl_11_func_800F0C70();
}
