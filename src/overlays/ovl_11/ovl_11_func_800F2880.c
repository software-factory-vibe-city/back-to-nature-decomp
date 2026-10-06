#include "common.h"
#include "game_types.h"
#include "psyq/memory.h"

/* User-authorized matching workaround: bind queue base, offset and index.
 * These bindings do not establish the original source's register choices. */
void ovl_11_func_800F2880(s16 arg0, s32 arg1) {
    register u8 *base asm("$4");
    register s32 index asm("$8");
    u8 *mid;
    register s32 off asm("$5");
    Ovl11QueuedEntry *p;
    Ovl11QueuedEntry *src;
    Ovl11QueuedEntry *q;
    s32 len;

    index = arg0;
    if (arg1 == 1) {
        off = index * 4;
        base = D_8007121C;
    } else {
        off = index * 4;
        base = D_8007126C;
    }
    p = (Ovl11QueuedEntry *)(off + (s32)base);
    mid = base + 4;
    src = (Ovl11QueuedEntry *)(off + (s32)mid);
    len = 0x50 - (index + 1) * 4;
    q = (Ovl11QueuedEntry *)(base + 0x4C);
    if (index == 19) {
        p->kind = -1;
        p->value = 0;
        p->day = 0;
    } else {
        memmove((char *)p, (char *)src, len);
    }
    q->kind = -1;
    q->value = 0;
    q->day = 0;
}
