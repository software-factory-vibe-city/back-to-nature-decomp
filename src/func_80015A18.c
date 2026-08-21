#include "common.h"
#include "game_types.h"

/* Read a u16 entry from the animation index table (SpriteSourceData.field_28).
 * arg1 is a signed short index multiplied by 4 (each animation-table entry is
 * 4 bytes; only the low u16 is consumed).
 */
u16 func_80015A18(SpriteSourceData *arg0, s32 arg1) {
    return *(u16 *)(arg0->field_28 + ((s32)(arg1 << 0x10) >> 0xE));
}
