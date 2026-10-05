#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
} UnkStruct800DA49C;

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
} UnkStruct800DA518;

void ovl_11_func_800DA49C(UnkStruct800DA49C *arg0, s32 arg1);
void ovl_11_func_800DA518(UnkStruct800DA518 *arg0, s32 arg1);
void ovl_11_func_800DA454(u16 *arg0, s32 arg1);

void ovl_11_func_800D9064(void) {
    s32 i;
    s32 j;

    for (i = 0; i < 0x19; i++) {
        for (j = 0; j < 0x2D; j++) {
            ovl_11_func_800DA49C((UnkStruct800DA49C *) &D_80071DFC[i][j], 0x10);
            ovl_11_func_800DA518((UnkStruct800DA518 *) &D_80071DFC[i][j], 8);
            ovl_11_func_800DA454((u16 *) &D_80071DFC[i][j], 0x10);
        }
    }
}
