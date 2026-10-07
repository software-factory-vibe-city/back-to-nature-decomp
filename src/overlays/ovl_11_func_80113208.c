#include "common.h"

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u16 unk6;
    /* 0x08 */ u8 unk8;
    /* 0x09 */ u8 unk9;
    /* 0x0A */ u8 padA;
    /* 0x0B */ u8 padB;
    /* 0x0C */ u8 unkC;
    /* 0x0D */ u8 unkD;
    /* 0x0E */ u8 padE;
    /* 0x0F */ u8 padF;
    /* 0x10 */ u8 unk10;
    /* 0x11 */ u8 unk11;
} Ovl11Obj80113208;

typedef struct {
    /* 0x00 */ u8 unk0;
    /* 0x01 */ u8 unk1;
    /* 0x02 */ u8 unk2;
    /* 0x03 */ u8 unk3;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ u8 unk6;
    /* 0x07 */ u8 unk7;
    /* 0x08 */ u16 unk8;
} Ovl11Rec801281D0;

s32 ovl_11_func_80113208(s16 arg0, s16 arg1, s16 arg2, s8 *arg3) {
    Ovl11Obj80113208 *temp_a3;
    Ovl11Rec801281D0 *temp_a2;
    char *src;
    char *base;
    s32 temp_a1;
    s32 temp_v1;
    s32 index;

    src = (char *)&D_8007AFF0;
    index = arg0 * 4 + arg1 * 0xB4;
    base = src + 0x23608;
    temp_a3 = *(Ovl11Obj80113208 **)(base + index);
    temp_a1 = temp_a3->unk0;
    if (temp_a1 & 8) {
        temp_a2 = (Ovl11Rec801281D0 *)((u8 *)&D_801281D0 + arg2 * 0xA);
        temp_v1 = temp_a1 & 0xFDFF0000;
        if (temp_v1 == 0x3D010000) {
            temp_a3->unk4 = temp_a2->unk0;
            temp_a3->unk5 = temp_a2->unk1;
            temp_a3->unk8 = temp_a2->unk2;
            temp_a3->unk9 = temp_a2->unk3;
            temp_a3->unkC = temp_a2->unk4;
            temp_a3->unkD = temp_a2->unk5;
            temp_a3->unk10 = temp_a2->unk6;
            temp_a3->unk11 = temp_a2->unk7;
            temp_a3->unk6 = temp_a2->unk8;
            return 0;
        }
        if (temp_v1 == 0x2D010000) {
            temp_a3->unk4 = temp_a2->unk0;
            temp_a3->unk5 = temp_a2->unk1;
            temp_a3->unk8 = temp_a2->unk2;
            temp_a3->unk9 = temp_a2->unk3;
            temp_a3->unkC = temp_a2->unk4;
            temp_a3->unkD = temp_a2->unk5;
            temp_a3->unk10 = temp_a2->unk6;
            temp_a3->unk11 = temp_a2->unk7;
            temp_a3->unk6 = temp_a2->unk8;
            return 0;
        }
    }
    return 1;
}
