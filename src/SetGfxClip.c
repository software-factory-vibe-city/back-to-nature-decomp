#include "common.h"
#include "game_types.h"

/* Set draw clip area (fields 0x2C, 0x30) for both display objects.
 * These likely represent clip rect coordinates (x1, y1 or width/height).
 * Both D_8005E3A8[0] and D_8005E3AC[0] are updated (double buffering).
 *
 * Requires -fno-schedule-insns -fno-schedule-insns2 (see flag_overrides.mk):
 * target has sequential lui/lw self-clobbering loads that GCC's scheduler
 * would otherwise interleave. */
void SetGfxClip(s32 arg0, s32 arg1) {
    register GfxObj *ptr_ac __asm__("v0");
    register GfxObj *ptr_a8 __asm__("v1");

    ptr_ac = D_8005E3AC[0];
    ptr_a8 = D_8005E3A8[0];
    ptr_ac->field_2C = arg0;
    ptr_a8->field_2C = arg0;
    ptr_ac->field_30 = arg1;
    ptr_a8->field_30 = arg1;
}
