#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u16 field_4;
    /* 0x06 */ char pad_06[0x12];
} Entry_800F53BC;

void ovl_11_func_800F53BC(s16 arg0, Entry_800F53BC *arg1) {
    Entry_800F53BC *p;
    s32 n;

    p = arg1;
    for (n = 0; n < arg0; n++) {
        if (p->field_4 & 0x20) {
            p->field_4 = p->field_4 | 1;
        } else if (p->field_4 & 0x40) {
            p->field_4 = p->field_4 & 0xFFFE;
        }
        p += 1;
    }
}
