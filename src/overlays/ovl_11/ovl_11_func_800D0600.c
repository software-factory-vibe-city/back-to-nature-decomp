#include "common.h"

/* Allowlisted entry-v0 capture, not an ordinary C parameter. The original
 * reads v0 before defining it and spills it to an unread stack slot; caller
 * 800D062C supplies sp+0x10. This is the documented static-chain fingerprint
 * also carried by 800D1CD0 and func_8001E9F8. The register declaration is
 * preserved from the previously exact attempt, with its policy exception
 * now recorded in .pi/autoloop.json. */
register s32 channel asm("$2");

/* Compares two indices and returns their rank difference folded to {0, 1, 2}:
 * equal -> 0, less -> 1, greater -> 2. */
s32 ovl_11_func_800D0600(s32 arg0, s32 arg1) {
    s32 tmp[2];

    tmp[0] = channel;
    if (arg0 == arg1) {
        return 0;
    }
    if (arg0 < arg1) {
        return 1;
    }
    return 2;
}