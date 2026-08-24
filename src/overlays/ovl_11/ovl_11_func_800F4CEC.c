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

void ovl_11_func_800F4CEC(void) {
    char *base;
    EntityD5D4 *p;

    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    p = *(EntityD5D4 **)(base + 0x5DD4);
    D_80129630 = p;
    p->field_0 = 1;
    p->field_8 = -0x1388;
    p->field_C = 0;
    p->field_10 = 0x8FC;
}
