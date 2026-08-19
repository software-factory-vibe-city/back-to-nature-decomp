#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80023A9C", func_80023A9C);


/* PARKED by /auto_decompilation_loop on 2026-08-19T17:41:02.623Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80023A9C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "globals_override.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80023B5C(u16 *arg0, u32 arg1);
void func_80023C2C(u16 *arg0, u32 arg1);

void func_80023A9C(s32 arg0) {
    u32 i = 0;
    u16 keep = 0xFFD;
    u16 *p = &D_800A0708[0];
    void (*fp)(u16 *, u32);

    for (i = 0; i < 0x10; i++) {
        *p++ = keep;
    }
    p = &D_800A0708[0];
    p[0xF] = 0xFFFF;
    if (arg0) {
        fp = func_80023B5C;
    } else {
        fp = func_80023C2C;
    }
    fp(&D_800A0708[0], i);
    func_80022580(D_8005E3C0->field_D8 + 0x68, 1, 0xAB, 0x20, 0x85, 0x12);
    func_80017B3C(D_8005E3C0->field_D8 + 0x64, (s32)&D_800A0708[0], 0xAD, 0x23);
}
#endif
