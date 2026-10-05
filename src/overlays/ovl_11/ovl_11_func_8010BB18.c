#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_2[0x2E];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x2];
    /* 0x34 */ s32 unk34;
} UnkStruct8010BB18;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);
void ovl_11_func_800D12A0(s16 arg0);

s32 ovl_11_func_8010BB18(UnkStruct8010BB18 *arg0) {
    char *far_base;

    if (arg0->unk0 == 0) {
        return -1;
    }
    if (!(arg0->unk34 & 4)) {
        ovl_11_func_80107DE0((UnkStruct80107DE0 *)((u8 *)arg0 + 0xA8), 0x25, 0x2D);
    }
    arg0->unk34 |= 4;
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        ovl_11_func_800D12A0(0xD);
    }
    return -1;
}
