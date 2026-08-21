/* Query one bit of the current animation frame's control byte.
 *
 * Reads the animation index table (field_28) and frame data table
 * (field_2C) from the SpriteSourceData object, exactly as the sibling
 * func_800158E4 does: field_4 indexes into the animation table to find a
 * {count, offset} pair, field_5 indexes frames within the animation, and
 * the offset + frame*0xA addresses one SpriteFrameData record. Returns
 * the control byte's jump bit (bit 7): 1 = control byte has 0x80 set
 * (jump to a new animation), 0 otherwise.
 */

#include "common.h"
#include "game_types.h"

/* {count, byte offset} pair from the animation index table (field_28) */
typedef struct {
    /* 0x00 */ s16 count;   /* number of frames in this animation */
    /* 0x02 */ u16 offset;  /* byte offset into the frame data table */
} SpriteAnimRef;

/* one frame's timing and control data (10 bytes, but only first 8 accessed) */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u16 field_4;
    /* 0x06 */ u8  duration; /* frame duration (compared against field_6) */
    /* 0x07 */ u8  control;  /* control byte: 0x80 = jump, 0xFF = end */
    /* 0x08 */ u16 field_8;
} SpriteFrameData;

u32 func_8001589C(SpriteSourceData *src) {
    SpriteAnimRef *animRef;
    SpriteFrameData *frameData;

    animRef = (SpriteAnimRef *)(src->field_28 + (src->field_4 * sizeof(SpriteAnimRef)));
    frameData = (SpriteFrameData *)(src->field_2C + animRef->offset + (src->field_5 * 0xA));
    return frameData->control >> 7;
}
