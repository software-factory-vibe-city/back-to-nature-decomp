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
    /* 0x00 */ char pad_00[0x18];
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

/* Animation state with table and frame-data pointers. */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u8 field_4;
    /* 0x05 */ u8 field_5;
    /* 0x06 */ u16 field_6;
    /* 0x08 */ char pad_8[0x20];
    /* 0x28 */ u8 *field_28;
    /* 0x2C */ u8 *field_2C;
} Struct_S;

#endif /* GAME_TYPES_H */
