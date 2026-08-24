#include "common.h"

extern u16 D_80070CF8;

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x2C - 0x02];
    /* 0x2C */ u16 field_2C;
    /* 0x2E */ char pad_2E[0x34 - 0x2E];
    /* 0x34 */ s32 field_34;
} Ov11FlagSet8010B218;

s32 ovl_11_func_8010B218(Ov11FlagSet8010B218 *arg0) {
    if (arg0->field_0 == 0) {
        return -1;
    }
    if ((u32)(D_80070CF8 - 6) >= 0xF) {
        arg0->field_2C = 0x12C;
        arg0->field_34 &= ~0x800;
    }
    return 0;
}
