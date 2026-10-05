#include "common.h"

INCLUDE_ASM("build/ovl_21/asm/nonmatchings/ovl_21_func_800B90C4", ovl_21_func_800B90C4);


/* PARKED by /auto_decompilation_loop on 2026-10-05T16:08:36.718Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_21_func_800B90C4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_21_func_800BA4C0(void);
s32 ovl_21_func_800B97F4(void);
s32 func_8002261C(s32 arg0, s32 arg1);
void SetVal8005E2BC(s32 arg0);
void SetVal8005E334(s32 arg0);

extern s16 D_800BCCD4[];

void ovl_21_func_800B90C4(void) {
    s32 s1;
    s32 s2;
    u8 *base;

    ovl_21_func_800BA4C0();
    s1 = ovl_21_func_800B97F4();
    if (s1 == -1) {
        func_8002261C(4, 0x26);
        s2 = 0xC;
    } else {
        s2 = 0xB;
        if (s1 == 0) {
            s2 = 0xA;
        }
        SetVal8005E2BC(0);
        SetVal8005E334(0);
        base = (u8 *)D_800C0448;
        func_8002261C(4, D_800BCCD4[*(s16 *)(base + 0x640 + s1 * 2)]);
    }
    base = (u8 *)D_800C0448;
    *(s16 *)(base + 0x988) = 0;
    D_800C0448[0] = s2;
}
#endif
