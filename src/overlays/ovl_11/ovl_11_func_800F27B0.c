#include "common.h"
#include "game_types.h"
#include "psyq/memory.h"

void ovl_11_func_800F27B0(s16 kind, s16 value) {
    u8 *base;
    u8 *tail;
    Ovl11QueuedEntry *p;
    s16 day;
    s32 i;

    base = (u8 *)D_8006C838;
    p = (Ovl11QueuedEntry *)(base + 0x49E4);
    day = *(s16 *)(base + 0x44BC);
    for (i = 0; i < 20; i++, p++) {
        if (p->kind == -1) {
            p->kind = kind;
            p->value = value;
            p->day = day;
            break;
        }
    }
    if (i == 20) {
        tail = D_8007121C;
        memmove(tail, tail + 4, 0x4C);
        tail -= 0x49E4;
        *(s8 *)(tail + 0x4A32) = kind;
        *(s16 *)(tail + 0x4A30) = value;
        *(u8 *)(tail + 0x4A33) = day;
    }
}
