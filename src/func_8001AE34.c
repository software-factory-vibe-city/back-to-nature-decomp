#include "common.h"

/* Forward declaration for game-specific integer power function */
s32 pow_int(s32 base, s32 exp);

/* Scans three data arrays for an entry whose first s16 field is in [0x15, 0x1A).
 * Returns the s16 at offset 4 of the first matching entry, or 0 if none found.
 * Each entry is 6 bytes (3 halfwords) with s16 fields at offsets 0 and 4. */
s32 func_8001AE34(void) {
    s32 s0;
    s32 i;
    s32 count;
    s16 *base;
    s16 exponent;
    s16 field0;

    base = (s16 *)0;
    count = 0;
    s0 = 0;
    while (s0 < 3) {
        switch (s0) {
            case 0:
                base = (s16 *)&D_80071A84;
                count = 1;
                break;
            case 1:
                base = (s16 *)&D_80071A90;
                exponent = base[-0x39];
                count = pow_int(2, exponent + 1);
                break;
            case 2:
                base = (s16 *)&D_80070EC2;
                count = 64;
                break;
        }

        for (i = 0; i < count; i++) {
            field0 = base[i * 3];
            if (field0 < 0x1A) {
                if (field0 >= 0x15) {
                    return base[i * 3 + 2];
                }
            }
        }
        s0++;
    }

    return 0;
}
