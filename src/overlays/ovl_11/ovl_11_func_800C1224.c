#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
} UnkStruct800C1224;

extern UnkStruct800C1224 D_80122F0C[14];

s32 ovl_11_func_800C1224(s16 arg0, s16 arg1) {
    s32 i;

    for (i = 0; i < 14; i++) {
        if (arg0 == D_80122F0C[i].unk0 && arg1 == D_80122F0C[i].unk2) {
            return i + 1;
        }
    }
    return 0;
}
