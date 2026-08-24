#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
    s32 field_4;
    s32 field_8;
    s32 field_C;
    s32 field_10;
} EntityD5D4;

extern EntityD5D4 *D_80129630;

void ovl_11_func_800F4CAC(void) {
    char *base;
    EntityD5D4 *p;
    EntityD5D4 *q;

    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    p = *(EntityD5D4 **)(base + 0x5DD4);
    q = (EntityD5D4 *)((char *)p + 0x18);
    D_80129630 = q;
    q->field_0 = 1;
    q->field_8 = -0x4B0;
    q->field_C = 0;
    q->field_10 = 0xB54;
}
