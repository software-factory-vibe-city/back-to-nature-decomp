#include "common.h"

/* User-authorized parked-function policy exception: two register variables
 * fix allocation and shift birth order. These are reconstruction workarounds,
 * not evidence of original register-variable source. */

s32 ovl_11_func_800D67F4(s16 arg0) {
    Ovl11A04B8Entry *p;
    s32 result;
    s32 offset;
    u32 i;
    u32 j;
    register u32 val asm("$6");
    register Ovl11A04B8Entry *base asm("$3");

    i = 0;
    offset = arg0 * 0x10E;
    base = (Ovl11A04B8Entry *)D_800A04B8;
    p = (Ovl11A04B8Entry *)(offset + (s32)base);
    do {
        val = i * 8;
        result = 1;
        j = 0;
        do {
            if (val == *(s16 *)p) {
                if (p->unk18 < 0x3F0) {
                    result = 0;
                }
            }
            j++;
            p++;
        } while (j < 9);
        if (result == 0) {
            i++;
            p = (Ovl11A04B8Entry *)(offset + (s32)base);
            continue;
        }
        return i;
    } while (i < 8);
    return 0;
}
