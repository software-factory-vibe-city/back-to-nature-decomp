#include "common.h"
#include "game_types.h"

/* GP-relative globals owned by this translation unit (tentative defs). */
s32 D_8005E2E8;
s32 D_8005E4F0;
s32 D_8005E4F4;
s32 D_8005E4F8;
s32 D_8005E4FC;
s32 D_8005E524;

/* 16-bit type codes (stored in the high half of the record header word),
 * masked with ~0x00200000, one per supported polygon layout. */
#define EAE4_TYPE_0 0x21010000
#define EAE4_TYPE_1 0x31010000
#define EAE4_TYPE_2 0x25010000
#define EAE4_TYPE_3 0x35010000
#define EAE4_TYPE_4 0x29010000
#define EAE4_TYPE_5 0x39010000
#define EAE4_TYPE_6 0x2D010000
#define EAE4_TYPE_7 0x3D010000
#define EAE4_TYPE_MASK 0xFDFF0000

s32 func_8001EAE4(s32 arg0, EAE4Query *arg1) {
    /* These were nested alongside this iterator in the original source. */
    auto s32 nested_E878(s32 p0, s32 p1, s32 p2) __asm__("func_8001E878");
    auto s32 nested_E9F8(s32 i0, s32 i1, s32 i2, s32 i3) __asm__("func_8001E9F8");
    s32 base0, type0;
    s32 base1, type1;
    s32 base2, type2;
    s32 base3, type3;
    s32 base4, type4;
    s32 base5, type5;
    s32 base6, type6;
    s32 base7, type7;
    s32 count = arg1->field_14;
    s32 offset0 = arg1->field_0;
    s32 offset10 = arg1->field_10;

    D_8005E524 = 0;
    D_8005E4F4 = count;
    D_8005E4F0 = arg0 + offset0;
    D_8005E4F8 = arg0 + offset10;
    D_8005E4FC = D_8005E2E8;

loop0:
    if (D_8005E4F4 == 0) goto ret1;
    base0 = D_8005E4F8;
    type0 = *(s32 *)base0;
    if ((type0 & EAE4_TYPE_MASK) != EAE4_TYPE_0) goto loop1;
    if ((type0 & D_8005E4FC) == 0) {
        if (nested_E878(D_8005E4F0 + ((u16 *)base0)[4] * 8, D_8005E4F0 + ((u16 *)base0)[5] * 8, D_8005E4F0 + ((u16 *)base0)[6] * 8) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x10;
    D_8005E4F4--;
    goto loop0;

loop1:
    if (D_8005E4F4 == 0) goto ret1;
    base1 = D_8005E4F8;
    type1 = *(s32 *)base1;
    if ((type1 & EAE4_TYPE_MASK) != EAE4_TYPE_1) goto loop2;
    if ((type1 & D_8005E4FC) == 0) {
        if (nested_E878(D_8005E4F0 + ((u16 *)base1)[8] * 8, D_8005E4F0 + ((u16 *)base1)[9] * 8, D_8005E4F0 + ((u16 *)base1)[10] * 8) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x18;
    D_8005E4F4--;
    goto loop1;

loop2:
    if (D_8005E4F4 == 0) goto ret1;
    base2 = D_8005E4F8;
    type2 = *(s32 *)base2;
    if ((type2 & EAE4_TYPE_MASK) != EAE4_TYPE_2) goto loop3;
    if ((type2 & D_8005E4FC) == 0) {
        if (nested_E878(D_8005E4F0 + ((u16 *)base2)[10] * 8, D_8005E4F0 + ((u16 *)base2)[11] * 8, D_8005E4F0 + ((u16 *)base2)[12] * 8) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x1C;
    D_8005E4F4--;
    goto loop2;

loop3:
    if (D_8005E4F4 == 0) goto ret1;
    base3 = D_8005E4F8;
    type3 = *(s32 *)base3;
    if ((type3 & EAE4_TYPE_MASK) != EAE4_TYPE_3) goto loop4;
    if ((type3 & D_8005E4FC) == 0) {
        if (nested_E878(D_8005E4F0 + ((u16 *)base3)[14] * 8, D_8005E4F0 + ((u16 *)base3)[15] * 8, D_8005E4F0 + ((u16 *)base3)[16] * 8) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x24;
    D_8005E4F4--;
    goto loop3;

loop4:
    if (D_8005E4F4 == 0) goto ret1;
    base4 = D_8005E4F8;
    type4 = *(s32 *)base4;
    if ((type4 & EAE4_TYPE_MASK) != EAE4_TYPE_4) goto loop5;
    if ((type4 & D_8005E4FC) == 0) {
        if (nested_E9F8(((u16 *)base4)[4], ((u16 *)base4)[5], ((u16 *)base4)[6], ((u16 *)base4)[7]) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x10;
    D_8005E4F4--;
    goto loop4;

loop5:
    if (D_8005E4F4 == 0) goto ret1;
    base5 = D_8005E4F8;
    type5 = *(s32 *)base5;
    if ((type5 & EAE4_TYPE_MASK) != EAE4_TYPE_5) goto loop6;
    if ((type5 & D_8005E4FC) == 0) {
        if (nested_E9F8(((u16 *)base5)[10], ((u16 *)base5)[11], ((u16 *)base5)[12], ((u16 *)base5)[13]) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x1C;
    D_8005E4F4--;
    goto loop5;

loop6:
    if (D_8005E4F4 == 0) goto ret1;
    base6 = D_8005E4F8;
    type6 = *(s32 *)base6;
    if ((type6 & EAE4_TYPE_MASK) != EAE4_TYPE_6) goto loop7;
    if ((type6 & D_8005E4FC) == 0) {
        if (nested_E9F8(((u16 *)base6)[12], ((u16 *)base6)[13], ((u16 *)base6)[14], ((u16 *)base6)[15]) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x20;
    D_8005E4F4--;
    goto loop6;

loop7:
    if (D_8005E4F4 == 0) goto ret1;
    base7 = D_8005E4F8;
    type7 = *(s32 *)base7;
    if ((type7 & EAE4_TYPE_MASK) != EAE4_TYPE_7) goto ret1;
    if ((type7 & D_8005E4FC) == 0) {
        if (nested_E9F8(((u16 *)base7)[18], ((u16 *)base7)[19], ((u16 *)base7)[20], ((u16 *)base7)[21]) == 0) {
            goto ret0;
        }
    }
    D_8005E4F8 += 0x2C;
    D_8005E4F4--;
    goto loop7;

ret1:
    return 1;

ret0:
    D_8005E524 = D_8005E4F8;
    return 0;
}
