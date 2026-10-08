#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"


void *memset ();
u16 *ovl_11_func_800CE744 (s32 arg0, s32 arg1);
void ovl_11_func_8010B64C (s32 arg0);
s32 ovl_11_func_8010C330 (s32 arg0);
void ovl_11_func_800D2D54 (void *arg0);

s32 ovl_11_func_800E8760(s32 arg0) {
    if ((arg0 << 0x10) == 0) {
        ovl_11_func_800CE744(0x15E, -1);
    } else {
        ovl_11_func_8010B64C((s32) &D_80075AD4);
    }
    return 1;
}
