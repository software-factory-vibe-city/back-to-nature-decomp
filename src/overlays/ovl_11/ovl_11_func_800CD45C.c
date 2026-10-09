#include "common.h"

typedef struct {
    s16 unk0;
    s8 unk2;
    char pad;
} Cd45cEntry;

extern s16 D_80070CF8;
extern Cd45cEntry D_801232A4[4];

s32 ovl_11_func_800D622C(s8 arg0, s8 arg1, s16 arg2, s32 arg3);

void ovl_11_func_800CD45C(void) {
    char *base = (char *)&D_80071A00;
    s16 *cmp;
    Cd45cEntry *p;
    u32 i;

    if (!(*(s32 *)(base + 0x6C) & 0x400000)) {
        cmp = (s16 *)(base - 0xD08);
        p = D_801232A4;
        i = 0;
        do {
            if (*cmp == p->unk0) {
                ovl_11_func_800D622C(0, p->unk2, 0, 0);
            }
            i += 1;
            p++;
        } while (i < 4U);
    }
}
