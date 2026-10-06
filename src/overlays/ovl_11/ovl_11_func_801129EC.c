#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_801129EC", ovl_11_func_801129EC);


/* PARKED by /auto_decompilation_loop on 2026-10-06T07:59:50.449Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_801129EC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */

#include "common.h"

s32 func_8001AF44(u32 arg0);

void ovl_11_func_80112C28();
void ovl_11_func_80112AB4();
void ovl_11_func_80112C98();
void ovl_11_func_80112B60();

void ovl_11_func_801129EC(void) {
    unsigned char *base;
    s16 idx;
    struct_80076220 *temp_s0;
    if (func_8001AF44(0x41) != 0) {
        base = (unsigned char *)&D_8006C838;
        idx = *(s16 *)(base + 0xE778);
        base = (unsigned char *)&D_80076220;
        base = base + idx * 0x1D4;
        temp_s0 = (struct_80076220 *)base;

        ovl_11_func_80112C28(temp_s0);
        ovl_11_func_80112AB4(temp_s0);
        ovl_11_func_80112C98(temp_s0);
        if (func_8001AF44(0x4F) != 0) {
            ovl_11_func_80112B60(&D_8007A3F0);
        }
    }
}
#endif
