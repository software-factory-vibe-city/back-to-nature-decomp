#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ char pad_24[0x08];
    /* 0x2C */ void *field_2C;
} D8006C838Lookup;

s32 ovl_11_func_800D5C90(s16 arg0) {
    D8006C838Lookup *v = (D8006C838Lookup *)&D_8006C838;
    s8 type;

    type = ((s8 *)v->field_20)[arg0 * 0x28 + 3];
    if (type == -1) {
        return -1;
    }
    return *(s16 *)((u8 *)v->field_2C + type * 0x10 + 4);
}
