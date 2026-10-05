#include "common.h"

/* Two unaligned s32 words copied as one 8-byte packed aggregate, as in
 * ovl_11_func_8010D04C (D_8006C838+0x44B8 -> object+0x1A). */
typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11UnalignedWord8010B778;

/* 0x38-byte flag/field record; only the witnessed fields are named. */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x34 - 0x02];
    /* 0x34 */ s32 field_34;
} Ov11Flag8010B778Arg;

s32 ovl_11_func_8010B830(Ov11Flag8010B778Arg *arg0);
void ovl_11_func_80107DD0(s16 *arg0);

s32 ovl_11_func_8010B778(s32 arg0, s32 arg1) {
    char *base;

    if (*(u16 *)arg0 != 0) {
        return -1;
    }
    memset((void *)arg0, 0, 0xF0);
    *(u16 *)arg0 = arg1;
    *(s16 *)(arg0 + 0x16) = 0xA;
    base = (char *)&D_8006C838;
    *(Ovl11UnalignedWord8010B778 *)(arg0 + 0x1A) = *(Ovl11UnalignedWord8010B778 *)(base + 0x44B8);
    *(s16 *)(arg0 + 0x30) = 3;
    *(s32 *)(arg0 + 0x38) = 0x1CC;
    *(s32 *)(arg0 + 0x3C) = 0;
    *(s32 *)(arg0 + 0x40) = 0x258;
    *(u16 *)(arg0 + 0x4) = 0xFFFF;
    ovl_11_func_8010B830((Ov11Flag8010B778Arg *)arg0);
    ovl_11_func_80107DD0((s16 *)(arg0 + 0xA8));
    return 0;
}
