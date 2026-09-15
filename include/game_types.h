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

/* Per-pad input/auto-repeat state object (0x38 bytes, 4 ports at D_8005E870).
 * Cleared restfully by func_80013F90; func_80013CD0 (per-pad processing
 * driver) drives the hold/edge/auto-repeat state machine, reading threshold
 * fields 0x18/0x1C and 0x2C/0x30 that func_80013F90 leaves alone. */
typedef struct {
    /* 0x00 */ s32 field_0x00;
    /* 0x04 */ s32 field_0x04;
    /* 0x08 */ s32 field_0x08;
    /* 0x0C */ s32 field_0x0C;
    /* 0x10 */ s32 field_0x10;
    /* 0x14 */ s32 field_0x14;
    /* 0x18 */ s32 field_0x18;
    /* 0x1C */ s32 field_0x1C;
    /* 0x20 */ s32 field_0x20;
    /* 0x24 */ s32 field_0x24;
    /* 0x28 */ s32 field_0x28;
    /* 0x2C */ s32 field_0x2C;
    /* 0x30 */ s32 field_0x30;
    /* 0x34 */ s16 field_0x34;
    /* 0x36 */ u8 field_0x36;
    /* 0x37 */ u8 field_0x37;
} Struct80013F90;

/* D_8006C838 view for func_80013CD0: s32 flag word at 0xC (bit 16 = pad
 * mutes actuator sync) and a pointer at 0x1C (the actuator object written by
 * func_80021DA8) whose store base has an s32 at 0 and a u16 at 4. */
typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ u16 field_4;
} D8006C838Inner;

typedef struct {
    /* 0x00 */ char pad_00[0x0C];
    /* 0x0C */ s32 field_0C;
    /* 0x10 */ char pad_10[0x0C];
    /* 0x1C */ D8006C838Inner *field_1C;
} D8006C838View;

/* Five 12-byte records within D_8006C838, also addressed as D_800742B0.
 * This is a partial view, not the full containing object's layout. */
typedef struct {
    /* 0x0000 */ char pad[0x7A78];
    /* 0x7A78 */ s16 records[5][6];
} D8006C838RecordTableView;

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

/* 8-byte entry in the D_80049170 table (indexed by arg1 in func_8001B2CC).
 * field_0 is read as a byte; field_4 as a u32 (a pointer into the same
 * 0x80049xxx region). */
typedef struct {
    /* 0x00 */ u8  field_0;
    /* 0x01 */ u8  field_1;
    /* 0x02 */ u8  field_2;
    /* 0x03 */ u8  field_3;
    /* 0x04 */ s32 field_4;
} Struct80049170;

/* 0x60-byte record copied out of the zero-init global D_8012D548 and passed
 * by value to ovl_11_func_8011D98C. That callee returns data[index]: the
 * s16 table sits at 0x28 and the s16 selector at 0x5C. The first 16 bytes
 * ride in $a0-$a3 and the rest are placed in the outgoing stack area. */
typedef struct {
    /* 0x00 */ char pad_00[0x28];
    /* 0x28 */ s16 data[26];
    /* 0x5C */ s16 index;
    /* 0x5E */ char pad_5E[0x60 - 0x5E];
} StructD548;

/* Argument-record views recovered by automatic matching reconstruction
 * (tools/agent/reconstructFunction.ts). Field offsets and widths are
 * witnessed by the functions' own accesses; names are placeholders pending
 * semantics. */
typedef struct {
    /* 0x00 */ s16 unk0;
} Ovl15Func80134444Arg;

typedef struct {
    /* 0x00 */ char pad_0[0x2];
    /* 0x02 */ u16 unk2;
} Ovl19Func800BA73CArg;

/* Shared by ovl_19_func_800BAC40 and ovl_19_func_800BAC50. */
typedef struct {
    /* 0x00 */ char pad_0[0x2];
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
} Ovl19Func800BAC40Arg;

/* Shared by ovl_23_func_800BB0C8 and ovl_23_func_800BB0D8. */
typedef struct {
    /* 0x00 */ char pad_0[0x4];
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ s16 unk8;
} Ovl23Func800BB0C8Arg;

/* Minimal views recovered from exact-match functions. Only the named fields
 * are witnessed; padding does not establish the full object extent. Names
 * include the container/function identity to avoid overlay-address collisions. */
typedef struct {
    u8 unk0;
} Recon_ovl_11_func_800BF3D0_CallRet1View;

typedef struct {
    char pad_0[0x1A];
    s16 unk1A;
    char pad_1C[0x50];
    s32 unk6C;
} Recon_ovl_11_func_800C97D0_A0View;

typedef struct {
    char pad_0[0x6C];
    s32 unk6C;
} Recon_ovl_11_func_800CD08C_A0View;

typedef struct {
    s16 unk0;
} Recon_ovl_11_func_800D3404_A0View;

typedef struct {
    s32 unk0;
} Recon_ovl_11_func_800D6380_A3View;

typedef struct { u16 unk0; } UnkStruct800DF4F0;

typedef struct {
    char pad_0[0xB0];
    u16 unkB0;
} Recon_ovl_11_func_800DEEE0_A0View;

typedef struct {
    char pad_0[0x2C];
    s16 unk2C;
    s16 unk2E;
    char pad_30[0x4];
    s32 unk34;
} Recon_ovl_11_func_800E0220_A0View;

typedef struct { u16 unk0; } UnkStruct800E109C;

typedef struct {
    char pad_0[0xB0];
    u16 unkB0;
} Recon_ovl_11_func_800E0AFC_A0View;

typedef struct {
    char pad_0[0x2C];
    s16 unk2C;
    s16 unk2E;
    char pad_30[0x4];
    s32 unk34;
} Recon_ovl_11_func_800E1D48_A0View;

typedef struct {
    s16 unk0;
} Recon_ovl_11_func_800FB394_A0View;

typedef struct {
    char pad_0[0x2C];
    s16 unk2C;
    s16 unk2E;
    char pad_30[0x4];
    s32 unk34;
} Recon_ovl_11_func_8010BF8C_A0View;

typedef struct {
    char pad_0[0x24];
    u8 unk24;
} Recon_ovl_17_func_800BAFAC_A0View;

typedef struct {
    char pad_0[0x24];
    u8 unk24;
} Recon_ovl_17_func_800BB094_A0View;

typedef struct {
    char pad_0[0x24];
    u8 unk24;
} Recon_ovl_17_func_800BB020_A0View;

typedef struct {
    char pad_0[0x4];
    s16 unk4;
    s16 unk6;
} Recon_ovl_19_func_800B9DD0_A0View;

typedef struct {
    char pad_0[0x4];
    s16 unk4;
    s16 unk6;
    char pad_8[0xA];
    s16 unk12;
} Recon_ovl_19_func_800BA054_A0View;

/* ovl_11_func_800D0408 arg1: three s32 vector components selected by a
 * direction code; the switch stores into exactly one of the fields. */
typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Recon800D0408A1View;

#endif /* GAME_TYPES_H */

/* Gradient-draw command shared by func_8001FA0C and func_8001F8A4 (0xC..0x14
 * is a RECT handed to SetDrawLoad; field_0/field_8 feed func_8001F774). */
typedef struct {
    /* 0x00 */ s32 field_0;     /* source u16 array */
    /* 0x04 */ s16 field_4;
    /* 0x06 */ u16 field_6;
    /* 0x08 */ s16 field_8;     /* gradient step count */
    /* 0x0A */ s16 field_A;
    /* 0x0C */ u16 field_C;     /* RECT x */
    /* 0x0E */ u16 field_E;     /* RECT y */
    /* 0x10 */ u16 field_10;    /* RECT w */
    /* 0x12 */ u16 field_12;    /* RECT h */
} GradientCmd;
