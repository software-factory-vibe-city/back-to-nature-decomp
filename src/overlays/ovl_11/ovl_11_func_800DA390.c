#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
} UnkStruct800DA390;

void ovl_11_func_800DA390(UnkStruct800DA390 *arg0) {
    arg0->unk2 = 0x167;
    arg0->unk0 = 0x167;
    arg0->unk4 = 0;
    arg0->unk5 = 0;
    arg0->unk6 = 0;
}
