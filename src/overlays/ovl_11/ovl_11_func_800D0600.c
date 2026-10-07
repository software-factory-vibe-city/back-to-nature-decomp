#include "common.h"

/* Compares two indices and returns their rank difference folded to {0, 1, 2}:
 * equal -> 0, less -> 1, greater -> 2.
 *
 * The target's dead `sw $v0, 0($sp)` is the documented entry-v0 capture
 * fingerprint, byte-identical to sibling ovl_11_func_800D1CD0 and also
 * carried by func_8001E9F8. CAPTURE_PREV_RET is the established block-scope
 * form of that idiom; caller ovl_11_func_800D062C seeds $v0 = $sp + 0x10. */
s32 ovl_11_func_800D0600(s32 arg0, s32 arg1) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);

    tmp[0] = phantom;
    if (arg0 == arg1) {
        return 0;
    }
    if (arg0 < arg1) {
        return 1;
    }
    return 2;
}