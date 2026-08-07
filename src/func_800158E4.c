/* Advance sprite animation state and update frame timing.
 *
 * Reads the animation index table (field_28) and frame data table
 * (field_2C) from the SpriteSourceData object. field_4 indexes into
 * the animation table to find a {count, offset} pair; field_5 indexes
 * frames within that animation; field_6 is a frame counter that
 * increments each call and resets when the frame duration elapses.
 *
 * The frame data's control byte (field_7) encodes:
 *   0x80 bit set  -> jump to a new animation (lower 7 bits = target index)
 *   0xFF          -> end of animation (loop if field_2 bit 0x100 is set)
 *   other nonzero -> jump to a new animation
 *
 * field_2 flags manipulated:
 *   0x100 -> loop flag (set when advancing frames)
 *   0x200 -> pause/hold flag (set on jump targets)
 *
 * field_0 bit 2 acts as a pause guard: when set, the function returns
 * immediately without advancing. */

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

void func_800158E4(SpriteSourceData *src) {
    SpriteAnimRef *animRef;
    SpriteFrameData *frameData;
    u16 flags;
    u32 frameCounter;
    u16 newFlags;
    u32 halfDuration;
    u32 newFrameIdx;
    u32 controlVal;
    u32 controlByte;
    s32 animLimit;

    /* Pause guard: field_0 bit 2 set means do not advance */
    if (!(src->field_0 & 4)) {
        /* Look up the animation's {count, offset} from the animation table */
        animRef = (SpriteAnimRef *)(src->field_28 + (src->field_4 * sizeof(SpriteAnimRef)));
        /* Compute pointer into frame data: offset + frame index * 0xA */
        frameData = (SpriteFrameData *)(src->field_2C + animRef->offset + (src->field_5 * 0xA));

        /* Clear loop (0x100) and pause (0x200) flags, preserve others */
        flags = src->field_2 & 0xFCFF;
        /* Increment frame counter */
        frameCounter = src->field_6 + 1;
        src->field_2 = flags;
        src->field_6 = frameCounter;

        /* Check if frame duration has elapsed (counter >= (duration+1)/2) */
        if ((s16)frameCounter >= (s32)(halfDuration = (u32)(frameData->duration + 1) >> 1)) {
            src->field_6 = 0;
            newFrameIdx = ++src->field_5;
            /* Set loop flag (0x100) when advancing to next frame */
            newFlags = flags | 0x100;
            do {
                animLimit = animRef->count;
            } while (0);
            /* Check if we've exceeded the animation's frame count */
            if ((s32)(newFrameIdx & 0xFF) >= animLimit) {
                src->field_2 = newFlags;
                controlVal = frameData->control;
                /* No jump bit: pause at last frame */
                if (!(controlVal & 0x80)) {
                    src->field_5 = controlVal & 0x7F;
                    src->field_2 = (newFlags & 0xFEFF) | 0x200;
                }
            }
            controlVal = frameData->control;
            controlByte = controlVal & 0xFF;
            if (controlByte != 0) {
                if (controlByte == 0xFF) {
                    /* End of animation: reset frame counter to half-duration,
                       decrement frame index, keep loop flag */
                    src->field_6 = halfDuration;
                    src->field_5 = src->field_5 - 1;
                    src->field_2 = src->field_2 | 0x100;
                } else if (controlVal & 0x80) {
                    /* Jump to new animation (lower 7 bits = target index) */
                    src->field_5 = controlVal & 0x7F;
                    src->field_2 = (src->field_2 & 0xFEFF) | 0x200;
                }
            }
        }
        D_8005E43C = 1;
    }
}
