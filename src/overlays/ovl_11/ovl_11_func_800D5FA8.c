#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
} UnkStruct800D5FA8;

void ovl_11_func_800D5FA8(UnkStruct800D5FA8 *arg0, s32 arg1) {
    s32 temp_a1;

    temp_a1 = arg1 & 0xFFFF;
    switch (temp_a1) {
    case 0x122:
        arg0->unk0 = 0x86;
        arg0->unk2 = 0;
        break;
    case 0x123:
        arg0->unk0 = 0x86;
        arg0->unk2 = 1;
        break;
    case 0x124:
        arg0->unk0 = 0x86;
        arg0->unk2 = 2;
        break;
    default:
        arg0->unk0 = temp_a1;
        arg0->unk2 = 0;
        break;
    }
    arg0->unk4 = 0;
}
