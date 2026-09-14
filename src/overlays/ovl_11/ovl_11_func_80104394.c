#include "common.h"

extern s16 D_8012CF10[7];

typedef struct {
    char pad_000[0xE514];
    s16 unkE514;         /* 0xE514 */
    s16 pad_516[6];      /* 0xE516-0xE521 */
    s16 rows[1][6][7];   /* 0xE522: s16[6][7] groups, 0x54 stride */
} ViewE522;

s32 ovl_11_func_80104394(void) {
    ViewE522 *v;
    s32 sel;
    s32 cnt;
    s32 res;

    v = (ViewE522 *)&D_8006C838;
    sel = 2;
    if (v->unkE514 != 3) {
        sel = v->unkE514;
    }
    res = 1;
    cnt = 0;
    do {
        if (D_8012CF10[cnt] != v->rows[sel][cnt][0]) {
            res = 0;
        }
        cnt += 1;
    } while (cnt < 6);
    return res;
}
