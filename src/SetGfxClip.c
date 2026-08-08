#include "common.h"
#include "game_types.h"

/* Set draw clip area (fields 0x2C, 0x30) for both display objects.
 * These likely represent clip rect coordinates (x1, y1 or width/height).
 * Both D_8005E3A8 and D_8005E3AC are updated (double buffering).
 *
 * D_8005E3A8/D_8005E3AC are GP-addressable but this TU does not own them
 * (func_80011370 does), so they are addressed absolutely: configs/tu_externs.txt
 * disowns them here, which keeps cc1's assembler macro and lets it expand to the
 * target's single-register self-clobber pair. No pins or flag overrides needed. */
void SetGfxClip(s32 arg0, s32 arg1) {
    GfxObj *ptr_ac;
    GfxObj *ptr_a8;

    ptr_ac = (GfxObj *)D_8005E3AC;
    ptr_a8 = (GfxObj *)D_8005E3A8;
    ptr_ac->field_2C = arg0;
    ptr_a8->field_2C = arg0;
    ptr_ac->field_30 = arg1;
    ptr_a8->field_30 = arg1;
}
