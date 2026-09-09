#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *p20;
    /* 0x24 */ char pad_24[0x04];
    /* 0x28 */ void *p28;
} D8006C838Lookup;

typedef struct {
    /* 0x00 */ char pad_00[4];
    /* 0x04 */ s16 arr[18];
} D8006C838Row;

s32 ovl_11_func_800D5ED4(u16 a, u16 b) {
    D8006C838Lookup *v = (D8006C838Lookup *)&D_8006C838;
    D8006C838Row *rows = (D8006C838Row *)v->p20;
    s16 t;
    u16 flags;
    u16 value;

    t = rows[a].arr[b];
    if (t == -1) {
        return -1;
    }
    flags = *(u16 *)((u8 *)v->p28 + t * 8 + 6);
    value = *(u16 *)((u8 *)v->p28 + t * 8 + 2);
    if ((flags & 0xE000) == 0) {
        return -1;
    }
    return value;
}
