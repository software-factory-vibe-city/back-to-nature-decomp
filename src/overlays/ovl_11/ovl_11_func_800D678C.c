#include "common.h"

s32 ovl_11_func_800D678C(s16 arg0) {
    Ovl11A04B8Entry *p;
    s32 result;
    u32 i;

    p = D_800A04B8[arg0];
    result = 1;
    i = 0;
    do {
        if (p->unk18 != -1) {
            if (p->unk18 >= 0x3F0) {
                result = 0;
            }
        }
        i++;
        p++;
    } while (i < 9);
    return result;
}
