#include "common.h"

s32 func_80024578(s32 arg0, s32 arg1) {
    s32 var_a0;
    /* register __asm__ required: compiler uses a2 for mflo, target uses v0 */
    register s32 var_v0 __asm__("v0");
    s32 var_v1;

    var_a0 = arg0;
    var_v1 = 0;
    if (var_a0 < 5) {
        var_v0 = 5;
    } else {
        var_v1 = 0x20;
        if (var_a0 < 0xA) {
            var_a0 -= 5;
            var_v0 = 5;
        } else {
            var_v1 = 0x40;
            var_a0 -= 0xA;
            var_v0 = 3;
        }
    }
    var_v0 = arg1 * var_v0;
    return (var_v1 + (var_v0 + var_a0)) & 0xFFFF;
}
