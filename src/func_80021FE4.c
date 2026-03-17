#include "common.h"

s32 *func_80021FE4(void) {
    s32 *temp_a0;
    /* register __asm__ required: compiles to different instructions without it */
    register u8 temp_v1 __asm__("v1");
    register s32 *var_v0 __asm__("v0");

    temp_a0 = (s32 *)&D_8006C838;
    temp_v1 = *(u8 *)((char *)temp_a0 + 0xCD);
    var_v0 = 0;
    if (temp_v1 == 0) {
        var_v0 = (s32 *)((char *)temp_a0 + 0xD8);
    }
    return var_v0;
}
