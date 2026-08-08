#include "common.h"

/*
 * func_8001FD74
 *
 * Load D_80061F1C and return non-zero as a Boolean (1 if != 0, 0 otherwise).
 *
 * Target:
 *   lui   $v1, %hi(D_80061F1C)
 *   lw    $v0, %lo(D_80061F1C)($v1)
 *   jr    $ra
 *   sltu  $v0, $zero, $v0
 */

s32 func_8001FD74(void) {
    return D_80061F1C != 0;
}
