#include "common.h"

/* User-authorized parked recovery: constrain real delta, cap, unsigned-load
 * and sum roles. All operations remain C under baseline compiler flags. */

void ovl_11_func_8011FF74(void *arg0, s16 arg1) {
    s32 limit;
    s32 current;
    register u32 value __asm__("$5");
    register s32 total __asm__("$2");
    register s32 delta __asm__("$6");
    register s32 cap __asm__("$7");

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
