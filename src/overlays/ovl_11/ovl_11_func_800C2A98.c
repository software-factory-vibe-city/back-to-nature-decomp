#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
} Ovl11UnalignedWord2;

/* arg0 struct whose fields at 0x14/0x16/0x1E/0x22 are accessed aligned,
 * while an s32 at byte offset 0x2C is stored unaligned (swl/swr). */
typedef struct {
    /* 0x00 */ u8 unk0[0x14];
    /* 0x14 */ s16 unk14;
    /* 0x16 */ u16 unk16;
    /* 0x18 */ u8 unk18[0x1E - 0x18];
    /* 0x1E */ u16 unk1E;
    /* 0x20 */ u8 unk20[0x22 - 0x20];
    /* 0x22 */ u16 unk22;
} Struct800C2A98;

void ovl_11_func_800C2A98(Struct800C2A98 *arg0) {
    u16 temp_v0;
    u16 temp_v1;
    u8 *elem;
    u8 *elem2;

    elem = (u8 *)arg0 + ((u32)arg0->unk22 * 8);
    *(Ovl11UnalignedWord2 *)((u8 *)arg0 + 0x2C) = *(Ovl11UnalignedWord2 *)(elem + 0xE8);
    elem2 = (u8 *)arg0 + ((u32)arg0->unk22 * 8);
    temp_v1 = (u16)(*(u16 *)(elem2 + 0xE6) >> 8);
    if (arg0->unk14 != (s16)temp_v1) {
        arg0->unk1E &= 0xFFEF;
    }
    temp_v0 = (u16)arg0->unk14;
    arg0->unk14 = (s16)temp_v1;
    arg0->unk16 = temp_v0;
}
