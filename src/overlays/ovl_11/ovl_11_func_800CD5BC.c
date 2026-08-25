#include "common.h"

typedef struct {
    /* 0x00 */ char pad0[0x36];
    /* 0x36 */ u16 flags;
    /* 0x38 */ char pad38[0x40 - 0x38];
    /* 0x40 */ u16 vals[(0x84 - 0x40) / 2];
    /* 0x84 */ s16 value;
} UnkStruct800CD5BC;

void ovl_11_func_800CD5BC(UnkStruct800CD5BC *arg0, s32 arg1) {
    s32 idx;
    s32 sum;

    if (!(arg0->flags & 8)) {
        idx = (arg0->value - 1) / 5;
        sum = arg1 + arg0->vals[idx];
        if (sum > 0xFFFF) {
            sum = 0xFFFF;
        }
        arg0->vals[idx] = (u16) sum;
    }
}
