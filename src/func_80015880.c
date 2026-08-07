#include "common.h"
#include "game_types.h"

/* Store the sprite-data header pointer at SpriteSourceData field_14 and
 * write a value to field_18 (reserved). Only called by func_80015704
 * during sprite-source initialization. */
void func_80015880(SpriteSourceData *src, s32 header, s32 field_18) {
    src->field_14 = header;
    src->field_18 = field_18;
}
