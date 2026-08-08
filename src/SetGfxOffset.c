#include "common.h"
#include "game_types.h"

/* Set display/draw offset (fields 0x18, 0x1C) for both display objects.
 * These likely represent X/Y offset values for the drawing environment.
 * Both D_8005E3A8 and D_8005E3AC are updated (double buffering).
 * 
 * Requires -fno-schedule-insns -fno-schedule-insns2 (see flag_overrides.mk)
 * to match the self-clobbering lui/lw pattern in the original binary. */
void SetGfxOffset(s32 arg0, s32 arg1) {
    GfxObj *ptr_ac;
    GfxObj *ptr_a8;

    ptr_ac = (GfxObj *)D_8005E3AC;
    ptr_a8 = (GfxObj *)D_8005E3A8;
    ptr_ac->field_18 = arg0;
    ptr_a8->field_18 = arg0;
    ptr_ac->field_1C = arg1;
    ptr_a8->field_1C = arg1;
}
