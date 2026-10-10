#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"


void *memset ();
void ovl_11_func_800C1C5C (s32 arg0);
void ovl_11_func_80107DD0 (s16 *arg0);
void ovl_11_func_800F0C70 (void);

void ovl_11_func_800C1C08(void) {
    s32 var_s1;
    struct_80076220 *var_s0;

    var_s0 = &D_80076220;
    var_s1 = 0x24;
    do {
        ovl_11_func_800C1C5C((s32) var_s0);
        ovl_11_func_80107DD0((s16 *) &var_s0->unk30[0xB0]);
        var_s1 -= 1;
        var_s0 += 1;
    } while (var_s1 >= 0);
    ovl_11_func_800F0C70();
}
