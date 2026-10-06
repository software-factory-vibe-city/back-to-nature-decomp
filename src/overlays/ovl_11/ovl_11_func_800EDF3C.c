#include "common.h"

/* User-authorized parked recovery: three real local register roles and
 * a two-instruction large-offset address prefix; calls and control are C. */

s32 func_8001AF44(u32 arg0);

s32 ovl_11_func_800EDF3C(s16 arg0, s32 arg1) {
    s16 var_a0;
    s32 temp_v0;
    register char *p asm("$3");
    register s32 off asm("$4");
    register u32 field asm("$5");

    if ((arg1 << 0x10) != 0) {
        var_a0 = D_80129560[arg0];
    } else {
        var_a0 = arg0;
    }
    if (var_a0 == 0xB) {
        goto block_b;
    }
    if (var_a0 == 0x14) {
        temp_v0 = func_8001AF44(0x25U);
        if (temp_v0 == 1) {
            if (D_80070CF2 == temp_v0) {
                goto ret1;
            }
            goto block_7;
        }
    }
    goto ret1;
block_7:
    return 0;
ret1:
    return 1;
block_b:
    if (func_8001AF44(0x129U) == 1) {
        goto block_7;
    }
    p = (char *) &D_8006C838;
    __asm__("ori %1,$0,0x8000\n\taddu %0,%2,%1"
            : "=r"(p), "=&r"(off) : "r"(p));
    field = *(u8 *) (p + 0x6647);
    off = 0xFF;
    if (field != off) {
        goto block_7;
    }
    goto ret1;
}