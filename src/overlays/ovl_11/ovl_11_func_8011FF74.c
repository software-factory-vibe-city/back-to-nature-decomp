#include "common.h"

void ovl_11_func_8011FF74(void *arg0, s16 arg1) {
    s32 limit;
    s32 current;
    u32 value;
    s32 total;
    s32 delta;
    s32 cap;

    delta = arg1;
    cap = 0xFF;
    limit = cap - delta;
    current = *(s16 *)((char *)arg0 + 0x16);
    value = *(u16 *)((char *)arg0 + 0x16);
    if (current < limit) {
        total = delta + value;
        *(s16 *)((char *)arg0 + 0x16) = total;
    } else {
        *(s16 *)((char *)arg0 + 0x16) = cap;
    }
}
