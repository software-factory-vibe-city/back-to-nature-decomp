#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x28];
    /* 0x28 */ u16 unk28;
    /* 0x2A */ u8 pad2[0x6];
} Ovl11FuncC9D4Entry;


Ovl11FuncC9D4Entry *ovl_11_func_800DC9D4(void) {
    s32 i;
    Ovl11FuncC9D4Entry *p;

    p = (Ovl11FuncC9D4Entry *)D_80128E08;
    for (i = 0; i < 0xF; i++, p++) {
        if (p->unk28 & 0x8000) {
            return p;
        }
    }
    return 0;
}
