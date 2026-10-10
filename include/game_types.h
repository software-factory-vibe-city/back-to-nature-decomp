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

/* Halfword position view read by ovl_11_func_800CE0F0. */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 pad_2;
    /* 0x04 */ u16 field_4;
    /* 0x06 */ u16 pad_6;
    /* 0x08 */ u16 field_8;
} Ovl11SpritePositionView;

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
    /* 0x10 */ char pad_10[0x08];
    /* 0x18 */ s32 field_18;
    /* 0x1C */ D8006C838Inner *field_1C;
} D8006C838View;

/* Five 12-byte records within D_8006C838, also addressed as D_800742B0.
 * This is a partial view, not the full containing object's layout. */
typedef struct {
    /* 0x0000 */ char pad[0x7A78];
    /* 0x7A78 */ s16 records[5][6];
} D8006C838RecordTableView;

/* One record of the 0x18-byte pools referenced by the pointer array at
 * D_8006C838+0xDD8C (built by func_80021E60 over D_8004ED04; 0xC5 records
 * per pool). func_800BF2F4 scans one pool for a record whose s16 at 0
 * matches a reference halfword and whose s32 at 8 / 0x10 lies inside a
 * range box; the u16 at 2 is the record's id/return value. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ char pad_04[0x04];
    /* 0x08 */ s32 unk8;
    /* 0x0C */ char pad_0C[0x04];
    /* 0x10 */ s32 unk10;
    /* 0x14 */ char pad_14[0x04];
} PoolRecord18;

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
typedef struct SpriteSourceData {
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

/* 0x60-byte record view passed by value from ovl_11_func_8011D734, which
 * supplies the selector word at 0x60 as a separate argument. Same layout as
 * StructD548 but its leading member is word-sized, so the record is 4-byte
 * aligned and the original by-value copy is a plain lw move (StructD548's
 * char leading member forces the unaligned ulw path). */
typedef struct {
    /* 0x00 */ s32 field_00[23];
    /* 0x5C */ s16 index;
    /* 0x5E */ s16 field_5E;
} Ovl11D548Arg;

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
    char pad_0[0x38];
    u16 unk38;
    char pad_3A[0x2];
    u16 unk3C;
} Recon_ovl_11_func_800C6F0C_A0View;

typedef struct {
    union {
        u8 unk0_b;
        s32 unk0_w;
    } unk0;
} Recon_ovl_11_func_800C6F0C_A1View;

typedef struct {
    char pad_0[0x1C];
    /* 0x1C */ u16 unk1C;
    char pad_1E[0x1A];
    /* 0x38 */ u8 unk38;
    char pad_39[0x3];
    /* 0x3C */ u16 unk3C;
    /* 0x3E */ u16 unk3E;
    char pad_40[0x2C];
    /* 0x6C */ s32 unk6C;
    char pad_70[0x14];
    /* 0x84 */ u16 unk84;
    char pad_86[0x6A];
    /* 0xF0 */ u16 unkF0;
    char pad_F2[0x173];
    /* 0x265 */ u8 unk265;
} Recon_ovl_11_func_800C7270_A0View;

typedef struct {
    char pad_0[0x38];
    u16 unk38;
    char pad_3A[0x50];
    s16 unk8A;
} Recon_ovl_11_func_800C8334_A0View;

typedef struct {
    char pad_0[0x1A];
    s16 unk1A;
    char pad_1C[0x50];
    s32 unk6C;
} Recon_ovl_11_func_800C97D0_A0View;

typedef struct {
    char pad_0[0x3C];
    /* 0x3C */ u16 unk3C;
} Recon_ovl_11_func_800CCFF8_A0View;

typedef struct {
    char pad_0[0x6C];
    s32 unk6C;
} Recon_ovl_11_func_800CD08C_A0View;

typedef struct {
    char pad_0[0x34];
    s32 unk34;
    char pad_38[0x4];
    s32 unk3C;
    char pad_40[0xC];
    s32 unk4C;
} Recon_ovl_11_func_800D2594_A0View;

typedef struct {
    s16 unk0;
} Recon_ovl_11_func_800D3404_A0View;

/* 0xB0-byte object initialised by ovl_11_func_800D3390: a u16 tag at 0x00
 * that selects the already-initialised path, an s16 selector at 0x00, a
 * u16 0xFFFF marker at 0x04, and two s16 at 0xA8/0xAA cleared by
 * ovl_11_func_80107DD0. Only the witnessed fields are named. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x2];
    /* 0x04 */ u16 unk4;
    /* 0x06 */ char pad_06[0xA2];
    /* 0xA8 */ s16 unkA8;
    /* 0xAA */ s16 unkAA;
    /* 0xAC */ char pad_AC[0x4];
} Recon_ovl_11_func_800D3390_A0View;

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
    char pad_0[0x26];
    s16 unk26;                /* 0x26 - selected handler id */
    s16 unk28;                /* 0x28 */
    s16 unk2A;                /* 0x2A */
    s16 unk2C;                /* 0x2C */
    char pad_2E[0x34 - 0x2E];
    s32 unk34;                /* 0x34 - flags (bit 11 = 0x800) */
    char pad_38[0xB8 - 0x38];
    u16 unkB8;                /* 0xB8 - flags, bit 11 cleared on select */
} Recon_ovl_11_func_8010CE80_A0View;

/* ovl_11_func_8010D250 argument view: reads the handler id at 0x26, a mode
 * at 0x30, and the staged s16 triple at 0xBE/0xC0/0xC2. */
typedef struct {
    char pad_0[0x26];
    s16 unk26;
    s16 unk28;
    s16 unk2A;
    s16 unk2C;
    char pad_2E[0x30 - 0x2E];
    s16 unk30;
    char pad_32[0xBE - 0x32];
    s16 unkBE;
    s16 unkC0;
    s16 unkC2;
} Recon_ovl_11_func_8010D250_A0View;

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

/* ovl_17_func_800BAD9C argument view: a D_800BD870 record (0x50 stride).
 * +0x14 points at a small animation/reference triple read as three s16s
 * (+0/+2/+4); +0x20 is passed to func_80015868 as a Struct_800154CC; the
 * bytes +0x24/+0x25 are read unsigned (lbu) and passed to func_80015EE8. */
typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} Recon_ovl_17_func_800BAD9C_AnimRef;

typedef struct {
    u8 field_0;                                  /* 0x00 */
    char pad_1[0x10 - 0x01];
    s32 field_10;                                /* 0x10 */
    Recon_ovl_17_func_800BAD9C_AnimRef *field_14; /* 0x14 */
    char pad_18[0x24 - 0x18];
    u8 field_24;                                 /* 0x24 */
    u8 field_25;                                 /* 0x25 */
} Recon_ovl_17_func_800BAD9C_A0View;

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

/* ovl_11_func_800CADBC arg0: array of three-s16 records; the function moves
 * each later non-empty record into the first empty slot and zeroes its source. */
typedef struct {
    s16 unk0;
    s16 unk2;
    s16 unk4;
} Ovl11Func800CADBCArg0;

/* ovl_11_func_800D0408 arg1: three s32 vector components selected by a
 * direction code; the switch stores into exactly one of the fields. */
typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Recon800D0408A1View;

/* Pointer argument to ovl_21_func_800B98CC: a signed selector at +2,
 * a stored s32 predicate at +0x18, and an unsigned halfword at +0x1C. */
typedef struct {
    /* 0x00 */ u8 pad_00[2];
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u8 pad_04[0x14];
    /* 0x18 */ s32 unk18;
    /* 0x1C */ u16 unk1C;
} Ovl21Func800B98CCArg;

/* Four-byte entries scanned by ovl_11_func_800F27B0. The signed byte
 * at +2 is the -1 empty marker; +0 is a halfword and +3 a byte. */
typedef struct {
    /* 0x00 */ s16 value;
    /* 0x02 */ s8 kind;
    /* 0x03 */ u8 day;
} Ovl11QueuedEntry;

/* D_8006C838 row view shared by the +0xE514 selector consumers.
 * Each row contains six seven-halfword entries (0x54 bytes). */
typedef struct {
    char pad_000[0xE514];
    s16 selector;
    s16 pad_516[6];
    s16 rows[1][6][7];
} Ovl11RowE522View;

/* Five 0x0C-byte records at D_8006C838 +0xE4D8, independently
 * indexed by the record initializer and resetter. */
typedef struct {
    char pad[0xE4D8];
    s16 recs[5][6];
} Ovl11RecordE4D8View;

/* ovl_17's 90-entry region at D_800BD848 +0x2D8 and the
 * following +0x5A8 cursor, shared by the initializer and append routine. */
typedef struct {
    s32 word;
    s16 field;
    s16 pad;
} Ovl17QueueEntry;

typedef struct {
    u8 pad[0x2D8];
    Ovl17QueueEntry entries[90];
    s16 cursor;
} Ovl17QueueView;

/* Fixed 41-halfword text scan buffer used by the two multi-row
 * layout wrappers. Whole-object assignment preserves the 82-byte copy. */
typedef struct {
    u16 data[41];
} TextCopyBlock;

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

/* Argument-record view witnessed by ovl_11_func_8011D890: a u16 selector at
 * 0x5C and a u32 mode word at 0x60, read off the stack past the spilled
 * first 16 bytes. Same record family as StructD548 but with an unsigned
 * selector (this function loads it with lhu, the D98C/D9B4 pair with lh)
 * and one extra word. Names are placeholders pending semantics. */
typedef struct {
    /* 0x00 */ char pad_00[0x5C];
    /* 0x5C */ u16 index;
    /* 0x5E */ char pad_5E[2];
    /* 0x60 */ u32 mode;
} Ovl11Func8011D890Arg;

/* Records of the table at D_80075BC4, scanned by ovl_11_func_801097F4:
 * six 0xB0-byte entries; entry u16 tag 0x15B at 0x00, an s16 selector at
 * 0x30, and two s32 coordinates at 0x38/0x40 range-tested against an
 * arg0/arg2 window of half-width arg5. Only the witnessed fields are named. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x2E];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[6];
    /* 0x38 */ s32 unk38;
    /* 0x3C */ char pad_3C[4];
    /* 0x40 */ s32 unk40;
    /* 0x44 */ char pad_44[0x6C];
} UnkStruct80075BC4;

/* Element of the D_800C0448 state table, stride 0x108. The two leading
 * halfwords are the state pair written by ovl_21_func_800B9538 /
 * ovl_21_func_800B95EC; ovl_21_func_800B9798 writes a halfword at 0x18 of
 * three consecutive entries starting at index arg0*3. Only the witnessed
 * fields are named. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ char pad_04[0x10];
    /* 0x14 */ s32 unk14;
    /* 0x18 */ s16 unk18;
    /* 0x1A */ u16 unk1A;
    /* 0x1C */ u16 unk1C;
    /* 0x1E */ u16 unk1E;
    /* 0x20 */ char pad_20[0x30 - 0x20];
    /* 0x30 */ void *unk30;
    /* 0x34 */ char pad_34[0x108 - 0x34];
} UnkStruct800C0448;

/* One of the six 0x108-byte records of the D_800C0448 state block, at
 * 0x14 + i * 0x108. It is the storage UnkStruct800C0448 indexes from the block
 * base: this record's unk0/unk4/unk6 are that element's unk14/unk18/unk1A. The
 * halfwords at unk6 are the position ovl_21_func_800BA698 reads (+0 and +4).
 * Only the fields ovl_21_func_800B990C touches are named. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ u16 unk6[3];
    /* 0x0C */ char pad_0C[0x1A - 0x0C];
    /* 0x1A */ s16 unk1A;
    /* 0x1C */ char pad_1C[0x108 - 0x1C];
} Ovl21C0448Record;

/* The whole D_800C0448 state block: a 0x14-byte header, the six records as an
 * array member, then scalar fields. The records must be an array member, not
 * pointer arithmetic: GCC adds a 4-aligned s32 field's offset to the base
 * before the scaled index only for an array member of a BLKmode object
 * (expr.c expand_expr COMPONENT_REF). Only witnessed fields are named. */
typedef struct {
    /* 0x000 */ char pad_000[0xC];
    /* 0x00C */ void *unkC;
    /* 0x010 */ char pad_010[4];
    /* 0x014 */ Ovl21C0448Record recs[6];
    /* 0x644 */ char pad_644[2];
    /* 0x646 */ s16 unk646;
    /* 0x648 */ char pad_648[0x65C - 0x648];
    /* 0x65C */ s16 unk65C;
    /* 0x65E */ char pad_65E[0x984 - 0x65E];
    /* 0x984 */ s16 unk984;
    /* 0x986 */ char pad_986[2];
    /* 0x988 */ s16 unk988;
} Ovl21C0448View;

/* ovl_11_func_801097F4 argument record, passed by value: the first 16 bytes
 * ride in $a0-$a3 and are homed to 0x0($sp) on entry; the witnessed tail
 * fields sit at 0x10 (s16 selector), 0x14 (s32 radius) and 0x18 (out
 * pointer). Only the fields the function reads are named. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ char pad_04[4];
    /* 0x08 */ s32 unk8;
    /* 0x0C */ char pad_0C[4];
    /* 0x10 */ s16 unk10;
    /* 0x14 */ s32 unk14;
    /* 0x18 */ UnkStruct80075BC4 **unk18;
} Ovl11Func801097F4Arg;

/* ovl_11_func_800CF95C argument record, passed by value like
 * Ovl11Func801097F4Arg: all 16 bytes ride in $a0-$a3 and are homed to
 * 0x0($sp) on entry. Only the fields the function reads are named. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
} Ovl11Func800CF95CArg;

/* ovl_11_func_801096FC argument record, passed by value like
 * Ovl11Func801097F4Arg: the first 16 bytes ride in $a0-$a3 and are homed to
 * 0x0($sp) on entry; the tail fields sit at 0x10 (s16 selector), 0x14 (s32
 * half-width), 0x18 (s32 flag out) and 0x1C (record out). Only the fields the
 * function reads are named. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ s16 unk10;
    /* 0x12 */ char pad_12[2];
    /* 0x14 */ s32 unk14;
    /* 0x18 */ s32 *unk18;
    /* 0x1C */ s32 **unk1C;
} Ovl11Func801096FCArg;

/* Records of the D_800749F4 table scanned by ovl_11_func_801096FC: twenty
 * 0xB8-byte entries sharing the Ovl11Func801097F4 record layout with an extra
 * halfword at 0x26 and a flag word at 0x34. Only the witnessed fields are
 * named. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x24];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ char pad_28[8];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[2];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ s32 unk38;
    /* 0x3C */ char pad_3C[4];
    /* 0x40 */ s32 unk40;
    /* 0x44 */ char pad_44[0xB8 - 0x44];
} Ovl11RecD749F4;

/* ovl_11_func_801098B0 argument record: a D_80075BC4-shaped record with an
 * extra s16 at 0xAC. The u16 tag at 0x00 gates the body, bit 0x8000 of the s32
 * at 0x34 gates the scan, the s16 at 0xAC selects the radius, 0x30 is the
 * scan selector, and 0x38/0x3C/0x40/0x44 are the four words forwarded to
 * ovl_11_func_801097F4. Only the witnessed fields are named. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x30 - 0x02];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ s32 unk38;
    /* 0x3C */ s32 unk3C;
    /* 0x40 */ s32 unk40;
    /* 0x44 */ s32 unk44;
    /* 0x48 */ char pad_48[0xAC - 0x48];
    /* 0xAC */ s16 unkAC;
} Ovl11Func801098B0Arg;

/* FuncC0D4Args - argument descriptor for func_8001C0D4: a primitive batch
 * pointer and the vector array origin. Shared by src/func_8001C0D4.c (its
 * local copy predates this header) and ovl_21_func_800BB2B4, which hands
 * &D_800C0DD8 to the callee. */
typedef struct {
    /* 0x00 */ void *batch;
    /* 0x04 */ s8 *vecs;
} FuncC0D4Args;

/* One 8-byte entry of the D_800BF87C record array written by
 * ovl_23_func_800B9454: s32 at +0, s16 at +4, s16 at +6. */
typedef struct {
    s32 unk0;   /* 0x00 */
    s16 unk4;   /* 0x04 */
    s16 unk6;   /* 0x06 */
} Ovl23D87CEntry;

/* D_800BF87C view for ovl_23_func_800B9454: a 54-entry array at 0x418
 * followed by the s16 write cursor at 0x5C8 (the 54 bound equals the array
 * length, matching the sibling ovl_23_func_800B94D0 whose 12-entry array at
 * 0x5CC is followed by its cursor at 0x62C). */
typedef struct {
    u8 pad_000[0x418];
    Ovl23D87CEntry unk418[54];  /* 0x418 */
    s16 unk5C8;                 /* 0x5C8 */
    u8 pad_5CA[2];
    Ovl23D87CEntry unk5CC[12];  /* 0x5CC */
    s16 unk62C;                 /* 0x62C */
} Ovl23D87CView;

/* One 0x44-byte entry of the D_800BF87C record array read by
 * ovl_23_func_800BA1E0; the value the function reads is the leading s32,
 * selected by the record's s16 index. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ char pad_04[0x40];
} Ovl23D87CEntry0;

/* D_800BF87C view for ovl_23_func_800BA1E0: a 0x44-stride record array at
 * offset 0x210. */
typedef struct {
    u8 pad_000[0x210];
    Ovl23D87CEntry0 unk210[32]; /* 0x210 */
} Ovl23D87CView210;

/* D_800BF87C view for ovl_23_func_800B9A00 (s16 fields at 0x39C and 0x3A0)
 * and ovl_23_func_800BA610 (which also reads the s16 at 0x3A2); the target
 * keeps the aggregate base and uses these offsets. */
typedef struct {
    u8 pad_000[0x39C];
    s16 unk39C;        /* 0x39C */
    u8 pad_39E[0x2];
    s16 unk3A0;        /* 0x3A0 */
    s16 unk3A2;        /* 0x3A2 */
    u8 pad_3A4[0xE];
    s16 unk3B2;        /* 0x3B2 */
} Ovl23D87CView39C;

/* ovl_23_func_800BA1E0 argument record: s16 selector at 0x00, s32 at 0x14
 * and s32 at 0x18. Only the fields the function reads are named. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ char pad_02[0x12];
    /* 0x14 */ s32 unk14;
    /* 0x18 */ s32 unk18;
} Ovl23Func800BA1E0Arg;

/* D_8006C838 status view used by ovl_11_func_800D0BC8. The final
 * halfword array is indexed with stride two; its full extent is unknown. */
typedef struct {
    char pad_000[0x44D0];
    u16 field_44D0;
    u16 field_44D2;
    char pad_44D4[0x99C8 - 0x44D4];
    s16 field_99C8[1];
} Ovl11Status99C8View;

/* D_8006C838 halfword triple at +0x5488 selected by ovl_11_func_800FA410. */
typedef struct {
    char pad_5488[0x5488];
    s16 field_5488;
    s16 field_548A;
    s16 field_548C;
} Ovl11Status5488View;

/* D_8006C838 slots compared by ovl_11_func_800C12DC: the +0x44B8 triple,
 * the +0x5488 triple, and the +0xE4DC halfword array stepped by six. */
typedef struct {
    char pad_000[0x44B8];
    s16 field_44B8;
    s16 field_44BA;
    s16 field_44BC;
    char pad_44BE[0x5488 - 0x44BE];
    s16 field_5488;
    s16 field_548A;
    s16 field_548C;
    char pad_548E[0xE4DC - 0x548E];
    s16 field_E4DC[1];
} Ovl11Status44B8View;

/* D_80074838 five 12-byte records read by ovl_11_func_800C12DC. */
typedef struct {
    char pad_000[0x64D8];
    s16 recs[5][6];
} Ovl11Rec64D8View;

/* D_80074838 work-area view used by ovl_11_func_800D079C: it reads an s16 at
 * +0x19C8 and steps it by two halfwords. The array extent is unknown. */
typedef struct {
    u8 pad_000[0x19C8];
    s16 field_19C8[1];
} Ovl11Work19C8View;

/* 0x30-byte table entry scanned by ovl_11_func_800DDC64. */
typedef struct {
    u8 pad[0x28];
    u16 unk28;
    u8 pad2[6];
} Ovl11FuncDDC64Entry;

/* Signed halfword lookup at D_8006C838+99DA; full extent is unknown. */
typedef struct {
    u8 pad[0x99DA];
    s16 values[1];
} Ovl11Value99DAView;

/* Nine byte cells at D_8006C838+E7A2, accessed by ovl_11_func_80108B8C. */
typedef struct {
    u8 pad[0xE7A2];
    u8 states[9];
} Ovl11StatesE7A2View;

/* Object fields written by ovl_11_func_800D05D0. */
typedef struct {
    char pad_00[0x34];
    s32 field_34;
    char pad_38[0x58 - 0x38];
    s32 field_58;
    s32 field_5C;
    s32 field_60;
} Ovl11SetFieldsView;

/* Parameter view of the four words ovl_11_func_800D062C reads (0x38, 0x40,
 * 0x58, 0x60) and passes in pairs to ovl_11_func_800D0600. */
typedef struct {
    /* 0x00 */ char pad_00[0x38];
    /* 0x38 */ s32 unk38;
    /* 0x3C */ char pad_3C[0x4];
    /* 0x40 */ s32 unk40;
    /* 0x44 */ char pad_44[0x14];
    /* 0x58 */ s32 unk58;
    /* 0x5C */ char pad_5C[0x4];
    /* 0x60 */ s32 unk60;
} Ovl11RankPair;

/* Callers pass four words; D0408 initializes and D05D0 consumes only
 * the three components. The final word is unused byte padding. */
typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
    u8 pad_C[4];
} Ovl11PaddedVec3;

/* Six-byte slot record at D_8006C838+0x524C; only the leading halfword is
 * read by ovl_11_func_800F9BE4. */
typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
} Ovl11Slot524C;

/* D_8006C838 view of the eighteen slot records at +0x524C (the D_80071A84 /
 * D_80071A8A aliases are slots 0 and 1), read by ovl_11_func_800F9BE4. */
typedef struct {
    char pad_000[0x524C];
    Ovl11Slot524C slots[18];
} Ovl11Slots524CView;
