#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80103B24", ovl_11_func_80103B24);


/* PARKED by /auto_decompilation_loop on 2026-10-03T03:10:30.163Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80103B24.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern s32 D_80127428;
extern s32 D_8012CF20;
extern u16 D_8012CF10[7];

typedef struct {
    char pad_000[0x49C8];
    s32 field_49C8;              /* 0x49C8 */
    char pad_49CC[0x5224 - 0x49CC];
    s32 field_5224;              /* 0x5224 */
    char pad_5228[0xE514 - 0x5228];
    s16 unkE514;                 /* 0xE514 */
    s16 pad_516[6];              /* 0xE516-0xE521 */
    s16 rows[1][6][7];           /* 0xE522: 0x54 stride */
} ViewB24;

void ovl_11_func_80103B24(void) {
    ViewB24 *v;
    ViewB24 *p;
    ViewB24 *w;
    s32 sel;
    s32 delta;
    s32 i;
    s32 three;
    s16 e;

    sel = 2;
    v = (ViewB24 *)&D_8006C838;
    e = v->unkE514;
    three = 3;
    if (e != three) {
        sel = e;
    }
    if (D_80127428 != three) {
        return;
    }
    p = (ViewB24 *)&D_8006C838;
    delta = p->field_5224 - D_8012CF20;
    if (delta > 0) {
        p->field_49C8 += delta;
    } else if (delta < 0) {
        v->field_49C8 += delta;
    }
    w = (ViewB24 *)&D_8006C838;
    w->field_5224 = D_8012CF20;
    for (i = 0; i < 6; i++) {
        w->rows[sel][i][0] = D_8012CF10[i];
    }
}
#endif
