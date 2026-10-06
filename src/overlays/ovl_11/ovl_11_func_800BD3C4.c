#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800BD3C4", ovl_11_func_800BD3C4);


/* PARKED by /auto_decompilation_loop on 2026-10-06T06:08:56.441Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800BD3C4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C(u8 *arg0);

extern s32 D_801227B0[];
extern s32 *D_80124FCC[];
extern s32 D_8008F7F8;

void ovl_11_func_800BD3C4(s32 arg0) {
    s32 *p;
    s32 *q;
    s32 n;
    char *base;

    void *t;
    void *save;
    p = &D_801227B0[arg0];
    func_80014BCC(0, p[0], p[1] - p[0], 0, D_8005E3B0 + 0x4290);
    t = (char *)&D_8007AFF0;
    save = (char *)t + 0x20000;
    t = D_80124FCC[arg0];
    *(s32 *)((char *)save + 0x5478) = arg0;
    n = *(s32 *)t;
    n = *(s32 *)((u8 *)t + (n << 2) + 4);
    memcpy(&D_8008F7F8, (void *)(D_8005E3B0 + 0x4290), n);
    func_8001719C((u8 *)((n + 0x4290) + D_8005E3B0));
}
#endif
