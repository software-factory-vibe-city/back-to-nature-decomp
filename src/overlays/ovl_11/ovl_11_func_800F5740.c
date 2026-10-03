#include "common.h"

/* 16-byte table entry: field_C (s32 at offset 12) is the match key */
typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
    s32 field_C;
} UnkTableEntry;

/* 24-byte struct that the function operates on */
typedef struct {
    u16 field_0;
    u16 field_2;
    s32 field_4;
    s32 field_8;
    s32 field_C;
    s32 field_10;
    s32 field_14;
} UnkStruct24;

extern UnkTableEntry D_80126CA0[];
extern UnkTableEntry D_80126CC0[];
extern UnkTableEntry D_80126D60[];

void ovl_11_func_800F5740(void) {
    char *base;
    UnkStruct24 *a2;
    UnkTableEntry *tbl;
    s32 t1;
    s32 t2;
    s32 v1;
    s32 sel;

    base = (char *)&D_8006C838;
    a2 = *(UnkStruct24 **)(base + 0xDD90);
    t2 = *(s16 *)(base + 0xDDDA);
    sel = *(u16 *)(base + 0x44CE);

    switch (sel) {
    case 0:
    case 3:
    default:
        tbl = D_80126CA0;
        t1 = 2;
        break;
    case 1:
        tbl = D_80126CC0;
        t1 = 10;
        break;
    case 2:
        tbl = D_80126D60;
        t1 = 10;
        break;
    }

    for (v1 = 0; v1 < t2;) {
        s32 i;
        s32 next_v1 = v1 + 1;
        for (i = 0; i < t1; i++) {
            if (a2->field_2 != tbl[i].field_C) {
                continue;
            }
            a2->field_8 = tbl[i].field_0;
            a2->field_C = tbl[i].field_4;
            a2->field_10 = tbl[i].field_8;
            break;
        }
        a2 = (UnkStruct24 *)((char *)a2 + 0x18);
        v1 = next_v1;
    }
}