#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x10];
    /* 0x10 */ u16 unk10;
    /* 0x12 */ u16 unk12;
    /* 0x14 */ u16 unk14;
    /* 0x16 */ u8 pad2[0x12];
    /* 0x28 */ u16 unk28;
    /* 0x2A */ u8 pad3[0x6];
} Ovl11FuncD8ACEntry;

extern s32 D_80129198;
extern Ovl11FuncD8ACEntry *D_80129194;

void ovl_11_func_800DD8AC(void) {
    s32 i;
    Ovl11FuncD8ACEntry *p;

    D_80129198 = 0;
    for (i = 0, p = (Ovl11FuncD8ACEntry *)D_80128E08; i < 0xF; i++, p++) {
        if (p->unk28 & 0x40) {
            p->unk10 = 0;
            p->unk12 = 0;
            p->unk14 = 0;
            D_80129194 = p;
            return;
        }
    }
    D_80129194 = 0;
}
