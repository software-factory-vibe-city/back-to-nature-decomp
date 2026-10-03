#include "common.h"

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
    ViewB24 *saved;
    ViewB24 *w;
    s32 sel;
    s32 delta;
    s32 i;
    s32 three;
    s16 e;

    sel = 2;
    v = (ViewB24 *)&D_8006C838;
    saved = v;
    e = v->unkE514;
    three = 3;
    if (e != three) {
        sel = e;
    }
    if (D_80127428 != three) {
        return;
    }
    p = v;
    v = saved;
    delta = v->field_5224 - D_8012CF20;
    if (delta > 0) {
        p->field_49C8 += delta;
    } else if (delta < 0) {
        p->field_49C8 += delta;
    }
    w = (ViewB24 *)&D_8006C838;
    w->field_5224 = D_8012CF20;
    for (i = 0; i < 6; i++) {
        w->rows[sel][i][0] = (u16)D_8012CF10[i];
    }
}
