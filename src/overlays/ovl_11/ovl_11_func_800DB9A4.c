#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800DB9A4", ovl_11_func_800DB9A4);


/* PARKED by /auto_decompilation_loop on 2026-10-08T01:10:32.751Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800DB9A4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"

void ovl_11_func_800DB9A4(void) {
    s32 i;
    u8 *s0;
    u8 *b1;
    u8 *p1;
    u8 *b;
    u8 *b2;
    u8 *b3;
    u8 *b4;
    s16 nv;
    u8 v1;
    u8 v2;

    memset(&D_800742AC, 0, 0x40);
    nv = -1;
    i = 4;
    s0 = (u8 *) &D_800742AC + 0x34;
    do {
        *(s16 *) s0 = nv;
        s0 -= 0xC;
        i -= 1;
    } while (i >= 0);

    b1 = (u8 *) &D_8006C838;
    (*(s32 *) (b1 + 0x30)) = 0;
    v1 = 0xFF;
    i = 0x7F;
    b1 += 0xE6BF;
    do {
        *b1 = v1;
        b1 -= 1;
        i -= 1;
    } while (i >= 0);

    v2 = 0xFF;
    for (i = 7; i >= 0; i--) {
        b2 = (u8 *) &D_8006C838;
        b2[0xE6C0 + i] = v2;
    }
    for (i = 0x7F; i >= 0; i--) {
        b3 = (u8 *) &D_8006C838;
        b3[0xE6C8 + i] = 0;
    }

    b4 = (u8 *) &D_8006C838;
    p1 = b4 + 0x8000;
    (*(s8 *) (p1 + 0x6641)) = 1;
    (*(s8 *) (p1 + 0x6646)) = 0x1E;
    (*(s8 *) (p1 + 0x664C)) = 0x1F;
    (*(s8 *) (p1 + 0x6650)) = 0;
    (*(s8 *) (p1 + 0x6655)) = 0x1C;
    (*(s8 *) (p1 + 0x6656)) = 0;
    (*(s8 *) (p1 + 0x6658)) = 0x76;
    (*(s8 *) (p1 + 0x6659)) = 0x1C;
    (*(s8 *) (p1 + 0x666C)) = 0;
}
#endif
