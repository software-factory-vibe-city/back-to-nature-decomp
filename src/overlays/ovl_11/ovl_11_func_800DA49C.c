#include "common.h"

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_800D5868(s16 arg0);

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
} UnkStruct800DA49C;

void ovl_11_func_800DA49C(UnkStruct800DA49C *arg0, s32 arg1) {
    u16 temp_a0;

    if (arg1 != 0) {
        temp_a0 = arg0->unk0;
        if (temp_a0 != 0x36) {
            if (ovl_11_func_800D5868((s16) temp_a0) == 1) {
                if (func_80012A34(arg1 & 0xFFFF) == 0) {
                    arg0->unk0 = 0x168;
                    arg0->unk2 = 0x168;
                    arg0->unk4 = 0;
                    arg0->unk5 = 0;
                    arg0->unk6 = 0;
                }
            }
        }
    }
}
