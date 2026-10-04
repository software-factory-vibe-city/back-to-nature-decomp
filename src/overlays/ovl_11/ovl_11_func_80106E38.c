#include "common.h"

/* Argument object read at 0x08 as an unsigned halfword. */
typedef struct {
    /* 0x00 */ char pad_00[0x8];
    /* 0x08 */ u16 unk8;
} Ovl11Func80106E38Arg;

/* Entry in the D_8012CF48 table (0x18 bytes each). */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s16 unkC;
    /* 0x0E */ s16 unkE;
    /* 0x10 */ s16 unk10;
    /* 0x12 */ s16 unk12;
    /* 0x14 */ s32 unk14;
} UnkStruct80106DC0;

extern UnkStruct80106DC0 D_8012CF48[];
void ovl_11_func_80106DC0(UnkStruct80106DC0 *arg0);

void ovl_11_func_80106E38(Ovl11Func80106E38Arg *arg0) {
    UnkStruct80106DC0 *entry = D_8012CF48;
    u32 i;

    i = 0;
    do {
        if (entry->unk0 == 0) {
            ovl_11_func_80106DC0(entry);
            entry->unk0 = 1;
            entry->unk14 = (s32)arg0;
            entry->unk2 = arg0->unk8;
            break;
        }
        i++;
        entry++;
    } while (i < 10U);
}
