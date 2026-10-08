#include "common.h"

/* Fields preserved across the memset that clears the record. */
typedef struct {
    s32 field_4;
    s32 field_8;
    s32 field_C;
    s32 field_10;
    u16 field_14;
} Ovl11Saved8010946C;

/* Two unaligned s32 words copied as one 8-byte packed aggregate, as in
 * ovl_11_func_8010D04C (D_8006C838+0x44B8 -> object+0x1A). */
typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11UnalignedPair8010946C;

s32 ovl_11_func_80109310(s32 *arg0);
void ovl_11_func_80107DD0(s16 *arg0);

s32 ovl_11_func_8010946C(s32 arg0, s32 arg1) {
    Ovl11Saved8010946C saved;
    char *base;
    s32 t0;
    s32 t1;
    s32 t2;
    s32 t3;
    u16 t4;
    s32 r0;
    s32 r1;
    s32 r2;
    s32 r3;
    u16 r4;

    if (*(u16 *) arg0 != 0) {
        return -1;
    }
    t0 = *(s32 *) (arg0 + 4);
    t1 = *(s32 *) (arg0 + 8);
    t2 = *(s32 *) (arg0 + 0xC);
    t3 = *(s32 *) (arg0 + 0x10);
    t4 = *(u16 *) (arg0 + 0x14);
    saved.field_4 = t0;
    saved.field_8 = t1;
    saved.field_C = t2;
    saved.field_10 = t3;
    saved.field_14 = t4;
    memset((void *) arg0, 0, 0xF0);
    *(u16 *) arg0 = arg1;
    *(s16 *) (arg0 + 0x16) = 0xA;
    r0 = saved.field_4;
    r1 = saved.field_8;
    r2 = saved.field_C;
    r3 = saved.field_10;
    r4 = saved.field_14;
    base = (char *) &D_8006C838;
    *(Ovl11UnalignedPair8010946C *) (arg0 + 0x1A) = *(Ovl11UnalignedPair8010946C *) (base + 0x44B8);
    *(s32 *) (arg0 + 4) = r0;
    *(s32 *) (arg0 + 8) = r1;
    *(s32 *) (arg0 + 0xC) = r2;
    *(s32 *) (arg0 + 0x10) = r3;
    *(u16 *) (arg0 + 0x14) = r4;
    ovl_11_func_80109310((s32 *) arg0);
    ovl_11_func_80107DD0((s16 *) (arg0 + 0xA8));
    return 0;
}
