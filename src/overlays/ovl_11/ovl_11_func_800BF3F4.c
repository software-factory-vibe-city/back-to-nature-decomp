#include "common.h"
#include "game_types.h"

void *func_8001EF98(void);

s32 ovl_11_func_800BF3F4(void) {
    u32 *p;
    u32 v;
    u32 r;

    p = func_8001EF98();
    if (p == 0) {
        return 0;
    }
    v = *p;
    if (v & 4) {
        return 2;
    }
    if (v & 0x40) {
        return 3;
    }
    r = v & 2;
    return r != 0;
}
