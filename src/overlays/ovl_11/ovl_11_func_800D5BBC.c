#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ void *field_24;
} D8006C838Lookup_800D5BBC;

s32 ovl_11_func_800D5BBC(void *arg0) {
    D8006C838Lookup_800D5BBC *v = (D8006C838Lookup_800D5BBC *)&D_8006C838;
    u16 *ptr;
    s16 temp_a0;
    s32 t0, t1, t2;

    temp_a0 = *(s16 *)((char *)v->field_20 + (*(s16 *)arg0 * 0x28) + 0x0E);
    if (temp_a0 == -1) {
        return -1U;
    }
    t0 = (s16)(temp_a0 * 5);
    t1 = t0 + (u16)*(u16 *)(arg0 + 2);
    t2 = (s16)t1;
    ptr = (u16 *)((char *)v->field_24 + t2 * 0xB0 + 0xAE);
    return *ptr;
}