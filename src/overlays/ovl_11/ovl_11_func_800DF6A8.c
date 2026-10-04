#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_2[0x2E];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x2];
    /* 0x34 */ s32 unk34;
} UnkStruct800DF6A8;

s32 ovl_11_func_800DF4F0(UnkStruct800DF6A8 *arg0);
void ovl_11_func_800D049C(UnkStruct800DF6A8 *arg0);
void ovl_11_func_800D12A0(s16 arg0);

s32 ovl_11_func_800DF6A8(UnkStruct800DF6A8 *arg0) {
    char *far_base;

    if (ovl_11_func_800DF4F0(arg0) == 0) {
        return -1;
    }
    if (!(arg0->unk34 & 4)) {
        ovl_11_func_800D049C(arg0);
    }
    arg0->unk34 |= 4;
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        ovl_11_func_800D12A0(9);
    }
    return 0;
}
