#include "common.h"
#include "game_types.h"

/* Set display/draw offset (fields 0x18, 0x1C) for both display objects.
 * These likely represent X/Y offset values for the drawing environment.
 * Both D_8005E3A8[0] and D_8005E3AC[0] are updated (double buffering). */
void SetGfxOffset(s32 arg0, s32 arg1) {
    GfxObj *v0 = D_8005E3AC[0];
    GfxObj *v1;
    __asm__ volatile("" : "=r"(v0) : "0"(v0));
    v1 = D_8005E3A8[0];
    v0->field_18 = arg0;
    v1->field_18 = arg0;
    v0->field_1C = arg1;
    v1->field_1C = arg1;
}
