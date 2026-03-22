#include "common.h"
#include "game_types.h"

/* Set display/draw offset (fields 0x18, 0x1C) for both display objects.
 * These likely represent X/Y offset values for the drawing environment.
 * Both D_8005E3A8[0] and D_8005E3AC[0] are updated (double buffering).
 * 
 * Requires -fno-schedule-insns -fno-schedule-insns2 (see flag_overrides.mk)
 * to match the self-clobbering lui/lw pattern in the original binary. */
void SetGfxOffset(s32 arg0, s32 arg1) {
    register GfxObj *ptr_ac __asm__("v0");
    register GfxObj *ptr_a8 __asm__("v1");

    ptr_ac = D_8005E3AC[0];
    ptr_a8 = D_8005E3A8[0];
    ptr_ac->field_18 = arg0;
    ptr_a8->field_18 = arg0;
    ptr_ac->field_1C = arg1;
    ptr_a8->field_1C = arg1;
}
