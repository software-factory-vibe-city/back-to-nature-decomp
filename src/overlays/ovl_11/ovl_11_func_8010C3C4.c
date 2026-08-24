#include "common.h"

/* 4-byte cells; the low s16 of each is cleared, 2 bytes of padding */
typedef struct {
    s16 field_0;
    s16 field_2;
} Cell4;

extern Cell4 D_80075854[];

void ovl_11_func_8010C3C4(void) {
    s32 i;
    Cell4 *p;
    char *base;

    p = D_80075854;
    i = 0x62;
    do {
        p->field_0 = 0;
        i -= 1;
        p += 1;
    } while (i >= 0);
    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    *(s16 *)(base + 0x19E4) = 0;
}
