#include "common.h"

/* Dispatch the action handler of the s16-indexed item table entry (D_8006C858
 * points at an array of 0x28-byte ItemData records). arg0 points at a record
 * with the s16 item index at +0 and a signed byte at +2. When the entry's
 * flags word (read unsigned, lhu) has bit 0x800 set the handler's first
 * argument is arg0's byte at +2, otherwise it is the signed byte at +4 of the
 * entry's action sub-structure at +0x1C. Calls the fn ptr at +0 of that
 * sub-structure as (s8, s8, s16, s32) and returns its result, or -1 when the
 * sub-structure pointer or the fn ptr is NULL. */
s32 ovl_11_func_800D58D0(void *arg0) {
    ItemData *entry;
    ItemAction *action;
    s32 arg;

    entry = &D_8006C858[*(s16 *)arg0];
    action = &entry->action;

    if (entry->u0.flags & 0x800) {
        arg = *(s8 *)((char *)arg0 + 2);
    } else {
        arg = action->field_4;
    }

    if (action != 0 && action->field_0 != 0) {
        return action->field_0(arg, action->field_5, action->field_6, 0);
    }
    return -1;
}
