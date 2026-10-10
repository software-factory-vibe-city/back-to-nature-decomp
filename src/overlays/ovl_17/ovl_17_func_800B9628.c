#include "common.h"

INCLUDE_ASM("build/ovl_17/asm/nonmatchings/ovl_17_func_800B9628", ovl_17_func_800B9628);


/* PARKED by /auto_decompilation_loop on 2026-10-10T01:04:07.926Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_17_func_800B9628.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    s32 field0;
    u8 pad[0x4C];
} Ovl17Rec;

typedef struct {
    u8 pad_000[0x38];
    Ovl17Rec recs[6];
    u8 pad_218[0x2BC - 0x218];
    s16 sel[6];
    u8 pad_2C8[0x2D4 - 0x2C8];
    s16 count;
} Ovl17SelView;

void ovl_17_func_800B9628(void) {
    Ovl17SelView *v;
    s16 best;
    s32 i;
    s32 j;

    v = (Ovl17SelView *) D_800BD848;
    if (v->count == 0) {
        v->sel[0] = -1;
    }
    for (i = 0; i < 6; i++) {
        if (v->recs[i].field0 > 0x7FFFFF) {
            j = 0;
            while (j < 6) {
                if (v->sel[j] == i) {
                    break;
                }
                j++;
            }
            if (j == 6) {
                v->sel[v->count] = i;
                v->count = v->count + 1;
            }
        }
    }
    {
        u8 *b;
        s32 *p;

        b = D_800BD848;
        if (*(s16 *) (b + 0x2D4) == 0) {
            best = 0;
            p = (s32 *) (b + 0x38);
            for (i = 0; i < 6; i++) {
                for (j = 0; j < 6; j++) {
                    if (*(s32 *) ((u8 *) p + best * 0x50) < *(s32 *) (b + 0x38 + j * 0x50)) {
                        best = j;
                    }
                }
            }
            b = D_800BD848;
            *(s16 *) (b + 0x2BC) = best;
        }
    }
}
#endif
