#include "common.h"

#include "game_types.h"

void ovl_11_func_800DDC64(void) {
    Ovl11FuncDDC64Entry *p;
    s32 i;
    u16 f;

    i = 0;
    p = (Ovl11FuncDDC64Entry *)D_80128E08;
    D_801291A8[0] = 0;
    D_801291A8[1] = 0;
    for (; i < 15; i++, p++) {
        f = p->unk28;
        if (f & 0x10) {
            f &= 1;
            D_801291A8[f] = (u32)p;
            if (f) {
                break;
            }
        }
    }
    ((Ovl11FuncDDC64Entry *)D_801291A8[0])->unk28 &= 0xEFFF;
    ((Ovl11FuncDDC64Entry *)D_801291A8[1])->unk28 |= 0x1000;
}
