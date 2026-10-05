#include "common.h"

typedef struct {
    char pad_000[0x5224];
    s32 field_5224;              /* 0x5224 */
    char pad_5228[0xE514 - 0x5228];
    s16 unkE514;                 /* 0xE514 */
    s16 pad_516[6];              /* 0xE516-0xE521 */
    s16 rows[1][6][7];           /* 0xE522: 0x54 stride */
} View3830;

void ovl_11_func_801037EC(void);
void func_8001FABC(s16 arg0);

void ovl_11_func_80103830(void) {
    View3830 *v;
    s16 sel;
    s32 cnt;

    v = (View3830 *)&D_8006C838;
    sel = 2;
    if (v->unkE514 != 3) {
        sel = v->unkE514;
    }
    ovl_11_func_801037EC();
    D_80127428 = 1;
    func_8001FABC(3);
    D_8012CF20 = v->field_5224;
    cnt = 0;
    do {
        D_8012CF10[cnt] = (u16)v->rows[sel][cnt][0];
        cnt += 1;
    } while (cnt < 6);
}
