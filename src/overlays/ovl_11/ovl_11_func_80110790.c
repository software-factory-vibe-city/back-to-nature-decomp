#include "common.h"

typedef struct {
    u16 unk0;
    char pad_02[2];
    u8 unk4;
} ReconA0View;

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ char pad_24[0x08];
    /* 0x2C */ void *field_2C;
} D8006C838Lookup;

s32 ovl_11_func_801108F8(ReconA0View *arg0);

s32 ovl_11_func_80110790(ReconA0View *arg0) {
    D8006C838Lookup *v;
    s32 temp;
    s8 type;

    if (ovl_11_func_801108F8(arg0) != 0) {
        temp = arg0->unk0;
        if (temp < 0x31) {
            /* valid */
        } else if (temp < 0x36) {
            return 0;
        } else if (temp < 0x17A) {
            if (temp >= 0x178) {
                return 0;
            }
        }
        v = (D8006C838Lookup *)&D_8006C838;
        type = ((s8 *)v->field_20)[arg0->unk0 * 0x28 + 3];
        if (arg0->unk4 == *(u16 *)((u8 *)v->field_2C + type * 0x10 + 2)) {
            return 1;
        }
    }
    return 0;
}
