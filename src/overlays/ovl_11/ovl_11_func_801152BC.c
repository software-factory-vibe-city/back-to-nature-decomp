#include "common.h"

typedef struct {
    /* 0x00 */ char pad0[0x8];
    /* 0x08 */ s16 unk8;
    /* 0x0A */ s16 unkA;
} UnkStruct801152BC;

void ovl_11_func_800F2354(s32 arg0, s32 arg1);

void ovl_11_func_800F397C(u16 arg0, u16 arg1);

void ovl_11_func_801152BC(UnkStruct801152BC *arg0) {
    ovl_11_func_800F2354(-(arg0->unkA * arg0->unk8), 1);
    ovl_11_func_800F397C(2, arg0->unk8);
}
