#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct800D0DB0;

void ovl_11_func_800D0DB0(UnkStruct800D0DB0 *arg0, s16 arg1, s16 arg2) {
    arg0->unk0 = arg1;
    arg0->unk2 = arg2;
}
