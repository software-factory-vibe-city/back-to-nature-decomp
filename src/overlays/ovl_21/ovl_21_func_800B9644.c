#include "common.h"

void ovl_21_func_800BA4C0(void);
void ovl_21_func_800BAB28(s16 arg0);

typedef struct {
    u8 pad_000[0x118];
    s16 unk118;
    u8 pad_11A[0x220 - 0x11A];
    s16 unk220;
} D800C0448View;

void ovl_21_func_800B9644(void) {
    u8 *base;
    u8 *p;

    ovl_21_func_800BA4C0();
    ovl_21_func_800BAB28(((D800C0448View *) D_800C0448)->unk118);
    ovl_21_func_800BAB28(((D800C0448View *) D_800C0448)->unk220);
    base = (u8 *) D_8006C838;
    p = base + 0x8000;
    *(s32 *) (p + 0x662C) = 1;
    *(u16 *) (p + 0x662A) = *(u16 *) (p + 0x6628);
    *(s32 *) (base + 0x448C) = *(s32 *) (base + 0x448C) + 1;
}
