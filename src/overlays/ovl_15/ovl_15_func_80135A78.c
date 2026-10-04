#include "common.h"
#include "psyq/memory.h"

extern u8 D_80137AB0[];
extern u8 *D_801376D0;

void ovl_15_func_80135A78(void) {
    u8 *base;
    s32 i;
    s32 size;

    D_801376D0 = D_80137AB0;
    base = D_80137AB0;
    size = 0x6441;
    for (i = 0xC8; i >= 0; i--) {
        memmove(base + 0x7F, base + 0x80, size);
        base += 0x7F;
        size -= 0x7F;
    }
}
