#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D0BC8", ovl_11_func_800D0BC8);


/* PARKED by /auto_decompilation_loop on 2026-09-08T23:08:52.747Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D0BC8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    char pad_000[0x44D0];
    u16 field_44D0;
    u16 field_44D2;
    char pad_44D4[0x99C8 - 0x44D4];
    s16 field_99C8[0x3C];
} D8006C838ViewD0BC8;

s32 ovl_11_func_800D0BC8(s32 arg0) {
    char *base = (char *)&D_8006C838;

    if (arg0 == 1) {
        if (*(u16 *)(base + 0x44D0) == 0) {
            return 2;
        }
    }
    if ((arg0 == 3) && (*(u16 *)(base + 0x44D2) == 0)) {
        return 2;
    }
    return ~*(s16 *)(base + 0x99C8 + arg0 * 4) != 0;
}
#endif
