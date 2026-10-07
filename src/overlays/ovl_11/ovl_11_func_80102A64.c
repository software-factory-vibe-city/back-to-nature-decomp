#include "common.h"

s32 func_8001F250(s32 arg0, s32 arg1);
void ovl_11_func_800D666C(s16 arg0);

extern u8 D_80071AC0;

/* 6-byte record: two s16 fields and an unsigned counter at +4. */
typedef struct {
    s16 f0;
    s16 f1;
    u16 f2;
} Rec6;

/* D_8006C838 view up to the s16 power exponent at 0x51E6. The two record
 * tables sit at +0x450A (second loop) and +0x5288 (D_80071AC0). */
typedef struct {
    char pad_0000[0x51E6];
    s16 field_51E6;
} View;

/*
 * Decrement the counter of the record matching arg0.
 *
 * Scan the first table (D_80071AC0, bounded by func_8001F250(2, exponent + 1));
 * on a match drop its +4 counter and, if it reaches zero, clear the id fields
 * and release it through ovl_11_func_800D666C, then return. Only when the first
 * table has no matching id is the second table (+0x450A, 0x40 entries) walked
 * the same way. Either match returns from the whole function.
 */
void ovl_11_func_80102A64(s32 arg0) {
    Rec6 *p;
    s32 i;
    u16 s2;

    s2 = arg0 & 0xFFFF;
    i = 0;
    p = (Rec6 *)&D_80071AC0;
    while (i < func_8001F250(2, ((View *)D_8006C838)->field_51E6 + 1)) {
        i++;
        if (p->f0 == s2) {
            p->f2 = p->f2 - 1;
            if ((s16)p->f2 <= 0) {
                p->f0 = 0;
                p->f1 = 0;
                ovl_11_func_800D666C(s2);
            }
            return;
        }
        p++;
    }

    i = 0;
    p = (Rec6 *)((u8 *)D_8006C838 + 0x450A);
    do {
        i++;
        if (p->f0 == s2) {
            p->f2 = p->f2 - 1;
            if ((s16)p->f2 <= 0) {
                p->f0 = 0;
                p->f1 = 0;
            }
            return;
        }
        p++;
    } while (i < 0x40);
}
