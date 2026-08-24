#include "common.h"

typedef struct {
    /* 0x00 */ u8 unk0[4];
    /* 0x04 */ s16 unk4;
} UnkStruct800D72E8;

s32 ovl_11_func_800D72E8(UnkStruct800D72E8 *arg0, s16 arg1) {
    s32 sum;

    sum = arg1 + (u16) arg0->unk4;
    arg0->unk4 = sum;
    if ((s16) sum == 0) {
        return 1;
    }
    if ((s16) sum < 0) {
        arg0->unk4 = -1;
    }
    return 0;
}
