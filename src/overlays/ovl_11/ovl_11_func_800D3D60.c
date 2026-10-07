#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D3D60", ovl_11_func_800D3D60);


/* PARKED by /auto_decompilation_loop on 2026-10-07T12:37:44.943Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D3D60.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "psyq/memory.h"

s32 func_80012A34(s32 arg0);

s32 ovl_11_func_800D3D60(u16 arg0) {
    u8 buf[20];
    s32 count;
    s32 i;
    s32 limit;
    u8 *p;
    s32 one;
    s32 mask;

    memset(buf, 0xFF, 20);
    one = 1;
    count = 0;
    limit = 10;
    if (arg0 == 0) {
        limit = 20;
    }
    for (i = 0; i < limit; i++) {
        mask = 0x20400;
        if (arg0 == 0) {
            p = (u8 *)&D_800749F4 + i * 0xB8;
        } else {
            p = (u8 *)&D_800749F4 - 0x708 + i * 0xB4;
        }
        if (!(*(u32 *)(p + 0x34) & mask) && *(s16 *)(p + 0x30) == one && *(u16 *)p != 0) {
            buf[count] = i;
            count++;
        }
    }
    if (count == 0) {
        return -1;
    }
    return buf[func_80012A34(count & 0xFFFF)];
}
#endif
