#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F2880", ovl_11_func_800F2880);


/* PARKED by /auto_decompilation_loop on 2026-10-05T10:37:34.135Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F2880.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "psyq/memory.h"

typedef struct {
    u16 unk0;
    s8 unk2;
    u8 unk3;
} Ovl11Record2880Entry;

void ovl_11_func_800F2880(s16 arg0, s32 arg1) {
    u8 *base;
    u8 *mid;
    s32 off;
    Ovl11Record2880Entry *p;
    Ovl11Record2880Entry *src;
    Ovl11Record2880Entry *q;
    s32 len;

    if (arg1 == 1) {
        off = arg0 * 4;
        base = (u8 *)D_8007121C;
    } else {
        off = arg0 * 4;
        base = (u8 *)D_8007126C;
    }
    p = (Ovl11Record2880Entry *)(base + off);
    mid = base + 4;
    q = (Ovl11Record2880Entry *)(base + 0x4C);
    src = (Ovl11Record2880Entry *)(mid + off);
    len = 0x50 - (arg0 + 1) * 4;
    if (arg0 == 19) {
        p->unk2 = -1;
        p->unk0 = 0;
        p->unk3 = 0;
    } else {
        memmove(p, src, len);
    }
    q->unk2 = -1;
    q->unk0 = 0;
    q->unk3 = 0;
}
#endif
