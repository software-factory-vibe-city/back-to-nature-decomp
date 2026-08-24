#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ char pad_24[0x04];
    /* 0x28 */ void *field_28;
} D8006C838Lookup;

typedef struct {
    /* 0x00 */ char pad_00[4];
    /* 0x04 */ s16 arr[18];
} D8006C838Row;

s32 ovl_11_func_800D5E00(u16 a, u16 b) {
    D8006C838Lookup *v = (D8006C838Lookup *)&D_8006C838;
    D8006C838Row *rows = (D8006C838Row *)v->field_20;
    s16 t;
    u32 z = 0;

    t = rows[a].arr[b];
    if (t == -1) {
        return 0;
    }
    return (*(u16 *)((u8 *)v->field_28 + t * 8 + 6) & 0x4000) > z;
}
