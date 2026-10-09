#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x8];
    /* 0x0A */ s16 field_A;
} Ovl11Func80106F20Inner;

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ char pad_06[0xE];
    /* 0x14 */ Ovl11Func80106F20Inner *unk14;
} Ovl11Func80106F20Entry;

extern Ovl11Func80106F20Entry D_8012CF48[];

s32 ovl_11_func_80106F20(s16 arg0, u16 arg1) {
    Ovl11Func80106F20Entry *entry;
    u32 i;
    s32 state;

    entry = D_8012CF48;
    for (i = 0; i < 10; i++, entry++) {
        if (entry->unk14->field_A != arg0) {
            continue;
        }
        state = entry->unk0;
        switch (state) {
        case 1:
            if (!(entry->unk14->unk0 & 0x200)) {
                func_8001FABC(0x16);
            }
            /* fallthrough */
        case 2:
        case 4:
            if (entry->unk14->unk0 & 0x200) {
                entry->unk0 = 1;
                return 1;
            } else {
                entry->unk0 = 2;
                entry->unk2 = arg1;
                return 1;
            }
        case 3:
            entry->unk4 += 5;
            return 1;
        default:
            continue;
        }
    }
    return 0;
}
