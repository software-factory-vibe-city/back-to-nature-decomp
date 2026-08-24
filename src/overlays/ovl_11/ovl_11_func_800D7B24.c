#include "common.h"

void ovl_11_func_800D7B24(void) {
    s32 i;
    s32 j;
    char *base;
    Ovl11D124Entry *row;

    i = 0;
    base = (char *)&D_80074124[0][0];
    for (; i < 7; i++) {
        row = (Ovl11D124Entry *)(base + i * 56);
        for (j = 0; j < 7; j++) {
            row[j].unk0 = 0x167;
            row[j].unk2 = 0x167;
            row[j].unk4 = 0;
            row[j].unk5 = 0;
            row[j].unk6 = 0;
        }
    }
}
