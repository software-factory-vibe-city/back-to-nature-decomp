#include "common.h"

s32 func_80012A34(s32 arg0);

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
} UnkStruct800DA518;

void ovl_11_func_800DA518(UnkStruct800DA518 *arg0, s32 arg1) {
    if (arg1 != 0) {
        if (arg0->unk0 == 0x36) {
            if (arg0->unk4 != 0) {
                if (func_80012A34(arg1 & 0xFFFF) == 0) {
                    arg0->unk4 = ovl_11_func_800D5C90(0x36);
                    arg0->unk5 = 0;
                    arg0->unk6 |= 0x8000;
                }
            }
        }
    }
}
