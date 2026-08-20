/* Shared type definitions for the game */
#ifndef GAME_TYPES_H
#define GAME_TYPES_H

#include "common.h"

/* Shared struct for functions that access void* with offset 0x14 and 0x18 */
typedef struct {
    /* 0x00 */ s32 field_0x0;
    /* 0x04 */ s32 field_0x4;
    /* 0x08 */ s32 field_0x8;
    /* 0x0C */ s32 field_0xC;
    /* 0x10 */ s32 field_0x10;
    /* 0x14 */ s32 field_0x14;
    /* 0x18 */ s32 field_0x18;
    /* 0x1C */ s32 field_0x1C;
} SomeStruct;

/* Graphics/drawing object used by D_8005E3A8 and D_8005E3AC arrays */
typedef struct {
    /* 0x00 */ char pad_00[0x4];
    /* 0x04 */ s32 field_4;
    /* 0x08 */ s32 field_8;
    /* 0x0C */ char pad_0C[0x18 - 0x0C];
    /* 0x18 */ s32 field_18;
    /* 0x1C */ s32 field_1C;
    /* 0x20 */ char pad_20[0x0C];
    /* 0x2C */ s32 field_2C;
    /* 0x30 */ s32 field_30;
} GfxObj;

/* Simple 3-element vector (used for position, rotation, etc.) */
typedef struct {
    s32 x;
    s32 y;
    s32 z;
} Vec3;

/* Simple 2-word structure for basic pair initialization */
typedef struct {
    s32 field_0;
    s32 field_4;
} PairS32;

/* Struct initialized by func_800154CC (0x18 bytes)
 * Offset 0x00 is accessed as s32; offsets 0x03-0x07 as s8; rest as s16.
 * First 3 bytes are separate so field_3 lands at offset 3.
 */
typedef struct {
    /* 0x00 */ s8  field_0;
    /* 0x01 */ s8  field_1;
    /* 0x02 */ s8  field_2;
    /* 0x03 */ s8  field_3;
    /* 0x04 */ s8  field_4;
    /* 0x05 */ s8  field_5;
    /* 0x06 */ s8  field_6;
    /* 0x07 */ s8  field_7;
    /* 0x08 */ s16 field_8;
    /* 0x0A */ s16 field_A;
    /* 0x0C */ s16 field_C;
    /* 0x0E */ s16 field_E;
    /* 0x10 */ s16 field_10;
    /* 0x12 */ s16 field_12;
    /* 0x14 */ s16 field_14;
    /* 0x16 */ s16 field_16;
} Struct_800154CC;

/* Object state/flags structure accessed by animation/state functions */
typedef struct {
    /* 0x00 */ char pad_00[0x02];
    /* 0x02 */ u16 field_2;     /* flags/status word */
    /* 0x04 */ s8 field_4;      /* state identifier */
    /* 0x05 */ s8 field_5;      /* sub-state or animation index */
    /* 0x06 */ s16 field_6;     /* timer or counter */
} ObjectState;

/* Struct initialized by func_80013F90; contains padded regions at 0x18 and 0x2C */
typedef struct {
    /* 0x00 */ s32 field_0x00;
    /* 0x04 */ s32 field_0x04;
    /* 0x08 */ s32 field_0x08;
    /* 0x0C */ s32 field_0x0C;
    /* 0x10 */ s32 field_0x10;
    /* 0x14 */ s32 field_0x14;
    /* 0x18 */ char pad_18[0x08];
    /* 0x20 */ s32 field_0x20;
    /* 0x24 */ s32 field_0x24;
    /* 0x28 */ s32 field_0x28;
    /* 0x2C */ char pad_2C[0x08];
    /* 0x34 */ s16 field_0x34;
} Struct80013F90;

/* Sprite data header: tag + offsets into the sprite's sub-tables.
 * Tag 0xE is the expected magic value (func_80015704 validates this).
 * Offsets at 0x10–0x20 are added to the header base to produce the
 * table pointers stored in SpriteSourceData. */
typedef struct {
    /* 0x00 */ s32 tag;          /* magic value 0xE */
    /* 0x04 */ s32 field_4;
    /* 0x08 */ s32 field_8;
    /* 0x0C */ s32 field_C;
    /* 0x10 */ s32 offset_tex;   /* -> SpriteTex[] (cel/texture rectangles) */
    /* 0x14 */ s32 offset_ref;   /* -> SpriteRef[] (sprite entry indices) */
    /* 0x18 */ s32 offset_18;    /* -> entry data (SpriteEntry[]) */
    /* 0x1C */ s32 offset_anim;  /* -> SpriteRef[] (animation frame index table) */
    /* 0x20 */ s32 offset_frame; /* -> frame data (SpriteFrame[] / control bytes) */
} SpriteDataHeader;

/* Sprite source-data / animation object (0x30 bytes).
 * Initialized by func_80015704 from a SpriteDataHeader, updated by
 * func_800158E4 (animation advance), and consumed by the renderer
 * wrappers (func_80016C08, func_800165D8, func_80016280).
 *
 * func_80015704 validates the header (alignment + tag == 0xE), zeroes
 * the state, sets field_8 to 0x1000, computes five table pointers from
 * header offsets, then calls func_80015880 to store the header pointer
 * at field_14 and clear field_18.
 *
 * func_800158E4 advances animation: field_4 indexes the animation table
 * (field_28), field_5 indexes frames within the selected animation,
 * field_6 is a frame-counter/timer, and field_2 holds loop/pause flags
 * (0x100 = loop, 0x200 = pause/hold).
 *
 * func_80016C08 reads field_24 (entry data), field_20 (sprite refs),
 * field_1C (texture cels), field_28 (animation index table), and
 * field_2C (frame data) to render one animation frame as POLY_FT4
 * primitives. */
typedef struct {
    /* 0x00 */ u16 field_0;     /* bit-flags (bit 2 = pause guard in func_800158E4) */
    /* 0x02 */ u16 field_2;     /* loop/pause flags (0x100 = loop, 0x200 = pause) */
    /* 0x04 */ u8  field_4;     /* current animation index */
    /* 0x05 */ u8  field_5;     /* current frame index within animation */
    /* 0x06 */ u16 field_6;     /* frame counter / timer */
    /* 0x08 */ s32 field_8;     /* initialized to 0x1000 (capacity / size hint) */
    /* 0x0C */ u16 field_C;     /* zeroed on init, purpose unknown */
    /* 0x0E */ u16 field_E;     /* zeroed on init, purpose unknown */
    /* 0x10 */ u16 field_10;    /* zeroed on init, purpose unknown */
    /* 0x12 */ u16 field_12;    /* zeroed on init, purpose unknown */
    /* 0x14 */ s32 field_14;    /* header pointer (set by func_80015880) */
    /* 0x18 */ s32 field_18;    /* reserved, cleared on init (set by func_80015880) */
    /* 0x1C */ s32 field_1C;    /* header + offset_tex  (SpriteTex * in func_80016C08) */
    /* 0x20 */ s32 field_20;    /* header + offset_ref  (SpriteRef * in func_80016C08) */
    /* 0x24 */ s32 field_24;    /* header + offset_18   (entry data base) */
    /* 0x28 */ s32 field_28;    /* header + offset_anim (animation index table) */
    /* 0x2C */ s32 field_2C;    /* header + offset_frame (frame data / control bytes) */
} SpriteSourceData;

/* Backward-compatibility alias for func_800158E4. */
typedef SpriteSourceData Struct_S;

/* Polygon-list query consumed by func_8001EAE4. */
typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
    s32 field_C;
    s32 field_10;
    s32 field_14;
} EAE4Query;

#endif /* GAME_TYPES_H */
