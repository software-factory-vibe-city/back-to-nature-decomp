#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_2[0x32];
    /* 0x34 */ s32 unk34;
} UnkStruct80109E64;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_80109E64(UnkStruct80109E64 *arg0) {
    if (arg0->unk0 == 0) {
        return -1;
    }
    if ((arg0->unk34 & 4) == 0) {
        ovl_11_func_80107DE0((UnkStruct80107DE0 *)((s32)arg0 + 0xA8), 0x25, 0x2D);
    }
    arg0->unk34 |= 4;
    return 0;
}
