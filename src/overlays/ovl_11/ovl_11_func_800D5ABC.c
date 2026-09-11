#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D5ABC", ovl_11_func_800D5ABC);


/* PARKED by /auto_decompilation_loop on 2026-09-11T16:13:37.311Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D5ABC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ void *field_24;
} D8006C838FuncLookup;

s32 ovl_11_func_800D5ABC(void *arg0) {
    D8006C838FuncLookup *v = (D8006C838FuncLookup *)&D_8006C838;
    s16 temp_a0;
    s32 t;
    char *base2;

    temp_a0 = *(s16 *)((char *)v->field_20 + (*(s16 *)arg0 * 0x28) + 0x0E);
    if (temp_a0 == -1) {
        return -1;
    }
    base2 = (char *)v->field_24;
    t = (s16)(temp_a0 * 5);
    t += (u16)*(u16 *)(arg0 + 2);
    t = (s16)t;
    base2 += t * 0xB0;
    return *(u16 *)(base2 + 0xAA);
}
#endif
