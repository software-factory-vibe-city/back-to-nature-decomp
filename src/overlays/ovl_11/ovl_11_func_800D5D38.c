#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D5D38", ovl_11_func_800D5D38);


/* PARKED by /auto_decompilation_loop on 2026-08-24T23:19:53.236Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D5D38.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
typedef struct { char p_0[0x20]; void *field_20; char p_24[4]; void *field_28; } D8006C838Lookup;
s32 ovl_11_func_800D5D38(u16 a, u16 b) {
    D8006C838Lookup *v = (D8006C838Lookup *)&D_8006C838;
    s16 t; u32 z = 0;
    t = *(s16 *)(b * 2 + 4 + (u8 *)v->field_20 + a * 0x28);
    if (t == -1) return 0;
    return (*(u16*)((u8*)v->field_28 + t*8 + 6) & 0x8000) > z;
}
#endif
