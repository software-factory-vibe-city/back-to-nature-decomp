#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

extern Cell4 D_80075854[];

void ovl_11_func_8010C5A0(Cell4 *arg0);
void ovl_11_func_8010C5DC(Cell4 *arg0);
s32 ovl_11_func_8010C668(void);

s32 ovl_11_func_8010C3F8(void) {
    Cell4 *cell;
    u16 *p;
    char *base;
    s32 count;

    cell = D_80075854;
    p = (u16 *)D_8006C838;
    if (p[0x48D4] & 1) {
        count = 0x62;
        do {
            if (cell->field_0 != 0) {
                cell->field_2 += 1;
                ovl_11_func_8010C5A0(cell);
                ovl_11_func_8010C5DC(cell);
            }
            count -= 1;
            cell += 1;
        } while (count >= 0);
    }
    base = (char *)&D_8006C838;
    base += 0x8000;
    *(u16 *)(base + 0x11A8) = (u16)(*(u16 *)(base + 0x11A8) & 0xFFFE);
    *(s16 *)(base + 0x19E4) = ovl_11_func_8010C668();
}
