#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad0[0x18];
    /* 0x18 */ u16 unk18;
    /* 0x1A */ u16 unk1A;
    /* 0x1C */ u16 unk1C;
    /* 0x1E */ u8 pad1[0x0E];
    /* 0x2C */ u16 unk2C;
    /* 0x2E */ u8 pad2[0x6];
} Ovl11FuncDCF10Entry;

void ovl_11_func_800DCE98(s32 arg0);
void func_8001BFA8(void *arg0, void *arg1);

Ovl11FuncDCF10Entry *ovl_11_func_800DCF10(void *arg0, void *arg1, void *arg2, u8 *arg3) {
    Ovl11FuncDCF10Entry *p;
    s32 i;

    p = (Ovl11FuncDCF10Entry *)D_801290D8;
    for (i = 0; i < 3; i++, p++) {
        if (p->unk2C & 0x8000) {
            ovl_11_func_800DCE98((s32)p);
            p->unk2C &= 0x7FFF;
            func_8001BFA8(p, arg0);
            func_8001BFA8((u8 *)p + 8, arg1);
            func_8001BFA8((u8 *)p + 0x10, arg2);
            p->unk18 = *(u16 *)(arg3 + 0);
            p->unk1A = *(u16 *)(arg3 + 2);
            p->unk1C = *(u16 *)(arg3 + 4);
            return p;
        }
    }
    return 0;
}
