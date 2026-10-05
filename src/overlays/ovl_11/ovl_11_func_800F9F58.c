#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F9F58", ovl_11_func_800F9F58);


/* PARKED by /auto_decompilation_loop on 2026-10-05T11:02:30.750Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F9F58.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 func_800226B0 (void);
void func_80022738 (void);
void func_8001FABC (s16 arg0);
void ovl_11_func_800F6640 (void);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void SetVal8005E2BC (s32 arg0);
void SetVal8005E334 (s32 arg0);

extern s32 D_80126F7C;
extern s32 D_80126F80;
extern s32 D_80126F88;

void ovl_11_func_800F9F58(void) {
    s32 temp_v1;

    if (func_800226B0() != 0) {
        temp_v1 = *(s32 *) ((u8 *) D_8005E3A8 + 8);
        if (temp_v1 & 0x50) {
            func_80022738();
            func_8001FABC(0);
            D_80126F80 = 0;
            return;
        }
        if (temp_v1 & 0x20) {
            if (D_80126F88 == 1) {
                ovl_11_func_800F6640();
            }
            func_80022738();
            D_80126F7C = 2;
            func_8001FABC(3);
        }
    }
}
/* Warning: struct GfxObj is not defined (only forward-declared) */
#endif
