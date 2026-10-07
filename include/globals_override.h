/*
 * Manual type overrides for auto-generated globals.
 *
 * classifyGlobals.ts generates globals.h with scalar types for all D_ symbols.
 * When a symbol's true type is known (e.g., it's a struct), define it here.
 * classifyGlobals.ts will skip any symbol that appears in this file.
 *
 * For absolute-addressed symbols (outside GP range), use the _D_ pattern:
 *   extern struct MyType _D_ADDR[1] __asm__("D_ADDR");
 *   #define D_ADDR (*((struct MyType*)_D_ADDR))
 *
 * For GP-relative symbols (within GP range), use plain extern:
 *   extern struct MyType D_ADDR;
 */
#ifndef GLOBALS_OVERRIDE_H
#define GLOBALS_OVERRIDE_H

/* Minimal SPU types for the D_8006C368 override below. Do not include
 * psyq/libspu.h here: its `void SpuGetAllKeysStatus` prototype reaches every
 * TU, but the original sound TU observes the call's return value (see
 * src/func_800212A8.c). Layout matches the PSY-Q 4.7 definitions exactly. */
typedef struct {
    short left;
    short right;
} SpuVolumeO;
typedef struct {
    SpuVolumeO volume;
    long reverb;
    long mix;
} SpuExtAttrO;
typedef struct {
    unsigned long mask;
    SpuVolumeO mvol;
    SpuVolumeO mvolmode;
    SpuVolumeO mvolx;
    SpuExtAttrO cd;
    SpuExtAttrO ext;
} SpuCommonAttrO;

/* Forward declaration - defined in game_types.h */
struct GfxObj;

/* Per-entry 8-byte table stored at offset 0xE4 of each D_80076220 record.
 * ovl_11_func_800F227C scans .unk0 (s16 threshold) and reads .unk2/.unk4/.unk6
 * of the first entry whose threshold is >= the requested value. */
typedef struct {
    s16 unk0;                 /* 0x00 */
    u8 unk2;                  /* 0x02 */
    u16 unk4;                 /* 0x04 */
    u16 unk6;                 /* 0x06 */
} struct_80076220_entry;

/* D_80076220 - absolute-addressed array of 0x1D4-byte entries.
 * ovl_11_func_800C1BE0 zeroes the u16 at offset 0xA of all 37 entries.
 * ovl_11_func_800C3CCC decrements the u16s at offsets 0x2 and 0x4 of all
 * 37 entries. ovl_11_func_800F227C writes unkC/unkE/unk22/unk2C/unk2E and
 * scans the 30-entry table at 0xE4. */
typedef struct {
    u8 unk0[2];               /* 0x00 */
    u16 unk2;                 /* 0x02 */
    u16 unk4;                 /* 0x04 */
    u8 unk6[0xA - 6];         /* 0x06 */
    u16 unkA;                 /* 0x0A */
    u16 unkC;                 /* 0x0C */
    u16 unkE;                 /* 0x0E */
    u8 unk10[0x1E - 0x10];    /* 0x10 */
    u16 unk1E;                /* 0x1E */
    u8 unk20[0x22 - 0x20];    /* 0x20 */
    u16 unk22;                /* 0x22 */
    s16 unk24;                /* 0x24 - read by ovl_11_func_800BFC20 */
    s16 unk26;                /* 0x26 - read by ovl_11_func_800BFC20 */
    u8 unk28[0x2C - 0x28];    /* 0x28 */
    u16 unk2C;                /* 0x2C */
    u16 unk2E;                /* 0x2E */
    u8 unk30[0xE4 - 0x30];    /* 0x30 */
    struct_80076220_entry unkE4[30]; /* 0xE4 - ends at 0x1D4 */
} struct_80076220;
extern struct_80076220 _D_80076220[1] __asm__("D_80076220");
#define D_80076220 (*((struct_80076220*)_D_80076220))

/* D_8012D050 - 3-entry {s16,s16} farm-state array (ovl_11, -G0 absolute).
 * ovl_11_func_80108B8C reads field_0 @0x8 / field_2 @0xA of entry [2]. */
typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
} Ovl11D050Entry;
extern Ovl11D050Entry D_8012D050[3];
/* The halfword view used by ovl_11_func_801082B0 has no witnessed full extent. */
extern s16 D_8012D050_halfwords[] __asm__("D_8012D050");

/* D_80128DB8 - overlay-private array of three 16-byte flat-light records
 * (GsF_LIGHT-shaped: s32 vx/vy/vz @0/4/8, u8 r/g/b @0xC/0xD/0xE), written by
 * ovl_11_func_800DB824 (absolute-addressed lui+lo in the target) and passed to
 * GsSetFlatLight. GsF_LIGHT itself lives in psyq/libgs.h, which this header
 * cannot include, so the .c casts the pointer at the call. */
typedef struct {
    /* 0x00 */ s32 vx;
    /* 0x04 */ s32 vy;
    /* 0x08 */ s32 vz;
    /* 0x0C */ u8 r;
    /* 0x0D */ u8 g;
    /* 0x0E */ u8 b;
    /* 0x0F */ u8 pad;
} Ovl11FlatLight;
extern Ovl11FlatLight _D_80128DB8[3] __asm__("D_80128DB8");
#define D_80128DB8 (_D_80128DB8)

/* D_8006C7B8 - absolute-addressed struct. func_800215EC writes a Vec3 at offsets 0/4/8.
 * func_80021604 reads offset 0 as an index and writes offsets 0xC–0x1C. */
typedef struct {
    s32 unk0;       /* 0x00 - Vec3.x / table index */
    s32 unk4;       /* 0x04 - Vec3.y */
    s32 unk8;       /* 0x08 - Vec3.z */
    s32 unkC;       /* 0x0C */
    s32 unk10;      /* 0x10 */
    s32 unk14;      /* 0x14 */
    s32 unk18;      /* 0x18 */
    s32 unk1C;      /* 0x1C */
    s32 unk20;      /* 0x20 */
    s32 unk24;      /* 0x24 */
    s32 unk28;      /* 0x28 */
} struct_8006C7B8;
extern struct_8006C7B8 _D_8006C7B8[1] __asm__("D_8006C7B8");
#define D_8006C7B8 (*((struct_8006C7B8*)_D_8006C7B8))

/* D_80061DE8 - shared struct used by func_8001B9F8 and func_8001BA40 */
struct struct_80061DE8 {
    s32 field_00;       /* 0x00 */
    s32 field_04;       /* 0x04 */
    s32 field_08;       /* 0x08 */
    s32 field_0C;       /* 0x0C */
    s32 field_10;       /* 0x10 */
    s32 field_14;       /* 0x14 */
    s32 field_18;       /* 0x18 */
    s32 field_1C;       /* 0x1C */
};

/* D_8005E3A8 and D_8005E3AC - graphics display object pointers
 * Target uses GP-relative sw (4-byte scalar, within -G8 threshold).
 * func_80011370 stores pointers here and reads them back. */
extern struct GfxObj *D_8005E3A8;
extern struct GfxObj *D_8005E3AC;

/* D_8006C838 - array of 0x3C-byte structs used for flags
 * Accessed with 0x3C stride but accessed in 4-byte s32 words
 * Struct size must be 4 bytes to get correct indexing (index * 0x3C as byte offset) */ 
struct struct_8006C838 {
    char data[0x3C];  /* 60 bytes per struct */
};
extern struct struct_8006C838 D_8006C838[];

/* View of D_8006C838 for bit-flag access: a flat array of u32 flag words
 * starts at offset 0x38 (used by func_8001AF44 and its set/clear siblings).
 * Index range comes from a 16-bit flag id: (0xFFFF >> 5) + 1 words. */
struct struct_8006C838_flags {
    char pad_000[0x38];     /* 0x00-0x37 */
    u32 flags[0x800];       /* 0x38: one word per 32 flag ids */
};

/* View of D_8006C838 for func_80022DF8: s32 flag word at 0xC (bit 27) and
 * u8 state byte at 0xCC (script/timer status, also touched by func_8002261C). */
struct struct_8006C838_view {
    char pad_000[0x0C];     /* 0x00-0x0B */
    s32 field_0C;           /* 0x0C */
    char pad_010[0xBC];     /* 0x10-0xCB */
    u8 field_CC;            /* 0xCC */
};

/* D_80076200 - four 4-byte records (s16 at +0) scanned by
 * ovl_11_func_800D08FC, which returns the address of the first record whose
 * leading s16 is -1. The same storage is also reached as D_8006C838+0x99D0.
 * Absolute-addressed (outside $gp), so it uses the _D_ label pattern. */
extern s16 _D_80076200[4] __asm__("D_80076200");
#define D_80076200 _D_80076200

/* D_8005F0A8 - s16 digit buffer. >8-byte declaration for the genuine split
 * address form (shared lui %hi base, see func_8001205C research).
 * func_8001A970 writes up to 10 halfwords (digits + terminator). */
extern s16 D_8005F0A8[10];

/* D_80055988 - s16 array accessed with absolute addressing (lui+addiu+lh)
 * Index: (s16)arg. Array size of 5 ensures >8 byte declaration for absolute addressing */
extern s16 D_80055988[5];

/* D_80049044 - u16 array accessed with lhu at index*2 (func_80019070)
 * Array size of 6 ensures >8 byte declaration for absolute addressing (lui+addiu) */
extern u16 D_80049044[6];

/* D_80048B1C - table of 0x28-byte entries (CD file table). func_80014854
 * reads the s32 at offset 0x24 (last s32) of entry [arg] as a CD position.
 * Byte stride 0x28 = 40, absolute-addressed (owned elsewhere). */
typedef struct {
    char name[0x24];    /* 0x00-0x23 - filename / padding */
    u32 loc;            /* 0x24 - CD position, logical >> */
} CDLocTableEntry;      /* 0x28 */

extern CDLocTableEntry D_80048B1C[];

/* D_80048B40 - view of the .loc fields of D_80048B1C as a flat s32 array.
 * Address 0x80048B40 = 0x80048B1C + 0x24 (offset of .loc within entry).
 * func_800145F0 accesses this with lui+addiu base (no extra offset addiu),
 * then indexes by arg*0x28. Array size forces >8 bytes for absolute addressing. */
extern s32 D_80048B40[4];

/* D_80049050 - array used by func_80017A70
 * Array size of 5 ensures >8 byte declaration for absolute addressing (lui+addiu) */
extern u16 D_80049050[5];

/* D_8005E43C - GP-relative update flag */
extern s32 D_8005E43C;

/* D_8005E500..D_8005E528 - GP-relative scalars used by func_8001E878
 * D_8005E500, D_8005E504, D_8005E508: cross-product results (sw gp_rel)
 * D_8005E50C, D_8005E510: bounds coordinates (sw gp_rel)
 * D_8005E514: average/difference (sw gp_rel, written twice)
 * D_8005E518: pointer to bounds struct (lw gp_rel, dereferenced at +0,+4,+8)
 * D_8005E51C: threshold value (lw gp_rel)
 * D_8005E528: flag (sw gp_rel)
 *
 * UNVERIFIED semantic hypotheses (2026-07-31) - floor/surface collision
 * query. func_8001E878 reads as a point-in-triangle test in the horizontal
 * plane plus a vertical tolerance check; the triangle vertices stride by 8
 * bytes in callers and use s16 fields at +0/+2/+4, i.e. SVECTOR-shaped
 * {vx, vy, vz, pad} with the cross products taken over (vx, vz) and vy
 * averaged as height (research note S5.4/S9).
 *   D_8005E500/504/508: edge cross products of query point vs triangle
 *     in the x-z plane
 *   D_8005E50C/510: cached query x and z ("bounds coords" = projected
 *     query position)
 *   D_8005E514: kept value is queryY - triangleAvgY, the signed height
 *     delta to the candidate triangle (avg written transiently first)
 *   D_8005E518: query position record {s32 x@0, y@4, z@8}, VECTOR-shaped;
 *     installed from a saved register by the driver func_8001E4C0
 *     (0x8001E534: sw s5) before the scan
 *   D_8005E51C: max |height delta| to accept (step-height tolerance)
 *   D_8005E528: hit flag - cleared by func_8001E4C0 (0x8001E508),
 *     set to 1 by func_8001E878, early-out guard in func_8001E38C
 *     (0x8001E38C reads it, then loads the three hit-triangle vertex
 *     pointers from the array at 0x80061EF8 and calls the SDK OuterProduct0
 *     with the query pointer)
 * Related, not declared here (addresses written 0x-style on purpose:
 * classifyGlobals treats any D_-token in this file as overridden):
 *   0x80061EF8: SVECTOR *[3], the hit triangle's vertex pointers
 *   0x8005E524: second flag cleared alongside the hit flag by the driver
 * Evidence: src/func_8001E878.c;
 * build/asm/nonmatchings/func_8001E4C0/func_8001E4C0.s (0x8001E504-538);
 * build/asm/nonmatchings/func_8001E38C/func_8001E38C.s (0x8001E38C-43C);
 * notes/research/func_8001E878-dead-spill-allocation.md */
typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} BoundsStruct_8001E878;
extern s32 D_8005E500;
extern s32 D_8005E504;
extern s32 D_8005E508;
extern s32 D_8005E50C;
extern s32 D_8005E510;
extern s32 D_8005E514;
extern BoundsStruct_8001E878 *D_8005E518;
extern s32 D_8005E51C;
extern s32 D_8005E528;

/* D_8005E540, D_8005E54C, D_8005E550, D_8005E554, D_8005E560 - GP-relative s32 scalars
 * Accessed by func_8001FF98 with sw %gp_rel; D_8005E54C by func_800214FC */
extern s32 D_8005E540;
extern s32 D_8005E54C;
extern s32 D_8005E550;
extern s32 D_8005E554;
extern s32 D_8005E560;

/* D_8005E44C - GP-relative s16 scalar (loaded with lh by func_80017AA0) */
extern s16 D_8005E44C;

/* D_8005E47A - signed halfword (lh) — func_80019030 owns it */
extern s16 D_8005E47A;

/* D_8005E444 - unsigned halfword (lhu) — func_80019030 owns it */
extern u16 D_8005E444;

/* D_8005E2ED - GP-relative byte (sb-only access by func_8001EFA4).
 * classifyGlobals defaults GP symbols with no nonmatching accessor to s32;
 * the only accessor is a matched function, so its access is invisible to the
 * generator. Declared here so classifyGlobals skips it (it will otherwise
 * regress globals.h to s32 and conflict with func_8001EFA4.c's s8 definition). */
extern s8 D_8005E2ED;

/* D_8005E4A8 - pointer to u16 array (lw, used as base) — func_80019030 owns it */
extern u16 *D_8005E4A8;

/* D_8005E025 - byte table accessed with absolute addressing (lui+addiu+lbu)
 * Array of 9 bytes ensures >8 byte declaration for absolute addressing */
extern u8 D_8005E025[9];

/* D_8005F0C8 - s32 array indexed by (value & 0xFFF), accessed with lui+addiu+lw
 * Array size ensures >8 byte declaration for absolute addressing */
extern s32 D_8005F0C8[4096];

/* D_80055994, D_800559BC - arrays of s32 pointers (byte table bases),
 * D_800559C4 - array of s32 function pointers.
 * All absolute-addressed (lui+addiu). Array size 3 ensures >8 bytes
 * to avoid GP-relative small-data addressing. */
extern s32 D_80055994[3];
extern s32 D_800559BC[3];
extern s32 D_800559C4[3];



/* D_8005E870 - struct accessed with sb at offsets 0x36 and 0x37 */
typedef struct {
    char pad[0x36];     /* 0x00-0x35 */
    u8 field_36;        /* 0x36 */
    u8 field_37;        /* 0x37 */
} struct_8005E870;
extern struct_8005E870 _D_8005E870[1] __asm__("D_8005E870");
#define D_8005E870 (*((struct_8005E870*)_D_8005E870))

/* D_80061F08 - struct used by func_8001FD84, func_8001FD10, func_8001FE00
 * Fields at 0x04, 0x08, 0x0C, 0x10, 0x14 for absolute addressing */
typedef struct {
    char pad[4];        /* 0x00-0x03 */
    s32 field_04;       /* 0x04 */
    s32 field_08;       /* 0x08 */
    s32 field_0C;       /* 0x0C */
    s32 field_10;       /* 0x10 */
    s32 field_14;       /* 0x14 */
} struct_80061F08;
extern struct_80061F08 _D_80061F08[1] __asm__("D_80061F08");
#define D_80061F08 (*((struct_80061F08*)_D_80061F08))

/* func_80021E60 - absolute-addressed globals whose addresses are stored */
extern s32 _D_8004B1A4[3] __asm__("D_8004B1A4");
#define D_8004B1A4 (*((s32*)_D_8004B1A4))
extern s32 _D_80049B1C[3] __asm__("D_80049B1C");
#define D_80049B1C (*((s32*)_D_80049B1C))
extern s32 _D_8004AFBC[3] __asm__("D_8004AFBC");
#define D_8004AFBC (*((s32*)_D_8004AFBC))
extern s32 _D_8004B044[3] __asm__("D_8004B044");
#define D_8004B044 (*((s32*)_D_8004B044))
extern s32 _D_80054BC8[3] __asm__("D_80054BC8");
#define D_80054BC8 (*((s32*)_D_80054BC8))
extern char D_8004ED04[0x124C];

/* D_8006C088 / D_8006C0A8 - sound-driver score tables, [6 songs][1 seq track].
 * The [s][t] shape with t == 1 (SEQ-only) follows the libsnd SsSetTableSize
 * idiom; the true 2D type is required for func_8001FF98 to match (the nested
 * init loop over the second dimension must survive as a real loop). */
extern s32 _D_8006C088[6][1] __asm__("D_8006C088");
#define D_8006C088 (_D_8006C088)
extern s32 _D_8006C0A8[6][1] __asm__("D_8006C0A8");
#define D_8006C0A8 (_D_8006C0A8)

/* D_8005E3C0 - pointer stored by func_80011370, accessed GP-relative.
   Scalar declaration (4 bytes) keeps it within -G8 threshold for %gp_rel. */
typedef struct {
    /* 0x000 */ char    pad_0[0x2];
    /* 0x002 */ u16     field_2;        /* u16 read by func_800183E0 (rect.y base) */
    /* 0x004 */ char    pad_4[0xD8 - 0x4];
    /* 0xD8 */  s32     field_D8;
    /* 0xDC */  s32     field_DC;
    /* 0xE0 */  s32     field_E0;
    /* 0xE4 */  s32     field_E4;
    /* 0xE8 */  char    pad_E8[0x4];
    /* 0xEC */  s32     field_EC;
    /* 0xF0 */  s32     field_F0;
    /* 0xF4 */  s32     field_F4;
    /* 0xF8 */  s32     field_F8;
    /* 0xFC */  char    pad_FC[0x14];
    /* 0x110 */ s32     field_110;
    /* 0x114 */ char    pad_114[0x4];
    /* 0x118 */ s32     field_118;
    /* 0x11C */ char    pad_11C[0x4];
    /* 0x120 */ s32     field_120;
    /* 0x124 */ s32     field_124;
    /* 0x128 */ s32     field_128;
    /* 0x12C */ s32     field_12C;
} struct_8005E3C0;
extern struct_8005E3C0 *D_8005E3C0;

/* D_800BF660 - ovl_19 bss object state base (0x800BF660). Referenced with
 * absolute addressing (lui + %lo) from ovl_19_func_800BAD50, which passes
 * its address as an ObjectState and reads the ObjectState fields at +4/+5
 * through a base pointer biased by -0x1A0. */
extern u8 D_800BF660[];

/* D_800BFC30 - ovl_23 bss object state base (0x800BFC30). Referenced with
 * absolute addressing (lui + %lo) from ovl_23_func_800BB1B8, which passes
 * its address as an ObjectState and reads the ObjectState fields at +4/+5
 * through a base pointer biased by -0x3B4. */
extern u8 D_800BFC30[];

/* D_800A0708 - 32-byte halfword table (u16[0x10]), absolute addressing.
 * func_80023A9C fills it with a walking halfword pointer (16 stores at
 * byte offsets 0..0x1E, stride 2) then writes entry 15 via a base+0x1E
 * displacement (the target's ori v0,0xFFFF proves unsigned typing);
 * func_80023B5C/func_80023C2C walk it by 2-byte units; a >8-byte element
 * keeps it out of the -G8 small-data range so it stays lui/lo_sum
 * addressed. Declared as an array so the target's array-index store
 * (base register + 30 displacement) is reachable. */
extern u16 _D_800A0708[0x10] __asm__("D_800A0708");
#define D_800A0708 (*(u16 (*)[0x10])_D_800A0708)

/* D_8005E3B4 — pointer to s32, absolute addressing (func_800134C4 loads with
 * lui/lw self-clobber, then dereferences the loaded pointer). */
extern s32 *D_8005E3B4;

/* D_8005E438 - GP-relative u16, sprite tile/entry ID storage */
extern u16 D_8005E438;

/* D_8005E5B4, D_8005E5CC - GP-relative s32 scalars (func_80022738) */
extern s32 D_8005E5B4;
extern s32 D_8005E5CC;

/* D_80010098, D_8001009C, D_8005E328 - absolute s32 scalars (func_80011370 / func_8001205C)
 *
 * Scalars, not arrays. Addressing mode does not follow from the declared size:
 * a translation unit that does not define the symbol addresses it absolutely
 * whatever its size. The size decides only whether cc1 splits the address, and
 * <= -G8 leaves the unsplit macro form that the assembler expands into the
 * single-register lui/lw pair these two targets use. Over-declaring either
 * past the threshold forces the two-register split form and stops the match. */
extern s32 D_80010098;
extern s32 D_8001009C;
extern s32 D_8005E328;

/* D_80010078, D_80010088 - CD-ROM filenames in .rodata (func_800147BC)
 * "\\A_FILE.HDT;1" and "\\A_FILE.BIN;1". Accessed absolutely with
 * unsplit lui/addiu. char[] keeps the symbol <= -G8 so the address
 * is not split; this TU does not define them so they are absolute. */
extern char D_80010078[];
extern char D_80010088[];

/* D_800100A0 - string embedded in func_80010000 at offset 0xA0 ("INIT ERROR\n")
 * Referenced by func_80015704 for FntPrint error messages.
 * s32 array of 3 forces >8 byte declaration for absolute addressing (lui+lw) */
extern s32 _D_800100A0[3] __asm__("D_800100A0");
#define D_800100A0 ((char*)_D_800100A0)

/* D_8005E9C8 - pad state buffer (2 records of 0x22 bytes, 0x44 total).
 * Its aggregate declaration is wider than -G8, preserving split address
 * formation in func_80014064. func_80014250 selects a record by arg0 and
 * indexes raw bytes; 2D byte-array typing matches the direct-index idiom
 * and -fno-cse-skip-blocks handling of the sibling D_8005EA18 in this TU. */
extern u8 _D_8005E9C8[2][0x22] __asm__("D_8005E9C8");
#define D_8005E9C8 (_D_8005E9C8)

/* Two eight-byte PadSetAct actuator tables: func_80014064 hands &D_8005EA18
 * to port 0 and &D_8005EA18 + 8 to port 0x10, and func_80014494 indexes them
 * by port. The 16-byte aggregate is wider than -G8, so it is addressed
 * absolutely (lui + %lo) rather than GP-relatively. */
extern u8 D_8005EA18[2][8];

/* Pad port IDs copied by func_800140C8. The incomplete aggregate type keeps
 * the object out of small data and preserves the two-byte object copy. */
typedef struct PadPortPair {
    s8 port0;
    s8 port1;
} PadPortPair;
extern PadPortPair D_8005E2AC[];

/* Pad actuator alignment data passed to PadSetActAlign. */
extern u8 D_80048B14[];

/* D_80049370 - s32 array used by func_80021604, func_80020E58, and
 * func_800214FC. The aggregate size preserves split absolute address formation. */
extern s32 D_80049370[3];

/* D_800495CC - per-sound-id s16 parameter table, 78 entries of 7 s16 fields
 * (0x800495CC..0x80049A0E, ending where D_80049A10 begins). Absolute-addressed
 * (lui+addiu) by func_800212A8 and neighbours; read as signed halfwords. */
extern s16 D_800495CC[78 * 7];

/* D_80049A70 - array of 4 s32 pointers to CD filename strings (func_800218C4).
 * Values point to "\\STR\\01.XA;1" through "\\STR\\04.XA;1" in rodata.
 * Absolute-addressed (lui+addiu). Array size 4 ensures >8 bytes. */
extern s32 D_80049A70[4];

/* D_8005E2A4 — GP-relative s32, per-port state flags (func_80013B04)
 * Size 2 keeps declaration <= 8 bytes for GP-relative addressing under -G8. */
extern s32 D_8005E2A4[2];

/* D_8005E3E8 — GP-relative s16, per-port actuator data (func_80013B04)
 * Size 2 keeps declaration <= 8 bytes for GP-relative addressing under -G8. */
extern s16 D_8005E3E8[2];

/* D_8005E5E8 — double-buffered DRAWENV/DISPENV pair (func_80011370).
 * Accessed at offsets 0x0..0x19A via absolute lui/addiu base (2*0x134 bytes
 * > -G8, so cc1 emits the split absolute lui/addiu address form).
 * Declared as env_struct_0x134[2] so element indexing stays a true ARRAY_REF:
 * expand_expr's get_inner_reference builds the element address base-first
 * (plus(base,offset)), which is what func_800128DC's addu base+offset with the
 * result in the base register needs. The three users only take &D_8005E5E8, so
 * the type change is address-neutral for them. */
typedef struct {
    char pad_0[0x17];
    /* 0x17 */ u8 unk17;
    /* 0x18 */ u8 unk18;
    char pad_19[0x130 - 0x19];
    void *field_130;
} env_struct_0x134;

extern env_struct_0x134 D_8005E5E8[2];

/* D_8005E644 — array of 0x134-stride render contexts (func_80012D30).
 * Not owned by func_80012D30's TU (absolute lui/addiu base in target); the
 * element stride 0x134 lets &D_8005E644[idx] produce the target's idx*0x134
 * address for PutDispEnv. Also declared char D_8005E3A4 is owned elsewhere
 * (func_80011370 / func_800120C8) and read absolutely here. */
extern env_struct_0x134 D_8005E644[];
extern s32 D_8005E3A4;

/* D_8005E8E0 / D_8005E910 — packet arrays indexed by D_8005E3A4 (func_80012D30).
 * Element strides 0x18 and 0xC. Declared as sized struct arrays so
 * get_inner_reference builds the element address base-first (the target's
 * lui(base) ... addu base+offset order); the .c casts elements to POLY_F4* /
 * DR_MODE* at use. */
typedef struct {
    char pad[0x18];
} packet_0x18;
typedef struct {
    char pad[0x0C];
} packet_0x0C;
extern packet_0x18 D_8005E8E0[];
extern packet_0x0C D_8005E910[];

/* D_8005E930 / D_8005E960 — packet arrays indexed by D_8005E3A4
 * (func_8001316C). Same shape as the D_8005E8E0 / D_8005E910 pair:
 * element strides 0x18 and 0xC; absolute-addressed (lui/addiu base in
 * the target; this TU does not define either symbol). */
extern packet_0x18 D_8005E930[];
extern packet_0x0C D_8005E960[];

/* D_8005E5D8 — pointer toggled between two buffer bases (func_80011370).
 * Target uses absolute lui/lw addressing. Array size forces >8 bytes. */
extern s32 _D_8005E5D8[3] __asm__("D_8005E5D8");
#define D_8005E5D8 (*((s32*)_D_8005E5D8))

/* D_80049A80 — absolute-addressed u16 array (func_80021CD8).
 * Accessed with lui/addiu/lhu at byte offset index*6 (index*3 elements).
 * Array size forces >8-byte declaration for absolute addressing under -G8. */
extern u16 _D_80049A80[6] __asm__("D_80049A80");
#define D_80049A80 ((_D_80049A80))

/* D_8005E330 — GP-relative s32 (func_800223D4 reads/writes via lw/sw %gp_rel). */
extern s32 D_8005E330;

/* D_80055974 — absolute-addressed s16 table (func_800223D4 indexes with lui/addiu/lh).
 * Array size 5 ensures >8 byte declaration for absolute addressing under -G8. */
extern s16 D_80055974[5];

/* D_8005E324 — GP-relative s16 (func_80021CD8 writes 1 via sh %gp_rel). */
extern s16 D_8005E324;

/* D_8005E580 — GP-relative s16 (func_80021CD8 writes via sh; func_8002194C reads signed via lh %gp_rel). */
extern s16 D_8005E580;

/* D_8005E584 — GP-relative s32 (func_80021CD8 reads via lw %gp_rel). */
extern s32 D_8005E584;

/* D_8005E588 — GP-relative s32 (func_80021CD8 reads+writes via lw/sw %gp_rel). */
extern s32 D_8005E588;

/* D_8005E58C — GP-relative s32 (func_80021CD8 writes via sw %gp_rel). */
extern s32 D_8005E58C;

/* D_8005E594 — GP-relative s32 (func_80021CD8 reads via lw %gp_rel). */
extern s32 D_8005E594;

/* D_8005E538 — GP-relative s32, sound system flag (func_8001FEA4 clears, func_80020E58/func_800214FC read/write). */
extern s32 D_8005E538;

/* D_8005E53C — GP-relative s32, sound initialization flag (func_80020818). */
extern s32 D_8005E53C;

/* D_8005E558 — GP-relative s32, sound system flag (func_8001FEA4 clears, func_800200E4 reads/writes). */
extern s32 D_8005E558;

/* D_8005E55C — GP-relative s32, stereo/mono flag (func_80020818, func_80020A14, func_80020A40). */
extern s32 D_8005E55C;

/* D_8006C368 — SpuCommonAttr global, absolute-addressed (func_8001FEA4 initializes fields
 * and passes to SpuSetCommonAttr). Override replaces s32[3] from globals.h. */
extern SpuCommonAttrO _D_8006C368[1] __asm__("D_8006C368");
#define D_8006C368 (*((SpuCommonAttrO*)_D_8006C368))

/* D_8005EE28 — 0x200-byte sprite upload staging buffer used by
 * func_80017300. The next symbol begins at D_8005F028, fixing the extent.
 * The target forms its address with split lui/addiu pairs; the declaration
 * therefore has to retain the full aggregate size (> -G8), not the scalar
 * type inferred from the symbol boundary. */
extern u8 D_8005EE28[0x200];

/* D_8005F0F8 — u16 sentinel value (func_8001A574 stores/loads via sh/lhu).
 * Declared as an array so the declared size is > -G8: the original TU's
 * declaration was >8 bytes, because every target access in the file family
 * (func_8001A574, func_8001A668) uses the cc1 split form
 * `lui reg,%hi` / `op %lo(reg)` (real register), not the <=-G8 assembler
 * macro (`lui $at` / `op`). A 2-byte declaration makes cc1 emit the raw
 * macro, which maspsx expands with $at — a different address form. See
 * notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md §2.4. */
extern u16 D_8005F0F8[6];

/* D_80049078 — array of 3 function pointers (func_8001A574 dispatch table).
 * Each callee takes one s32 argument and returns s32. Absolute-addressed (12 bytes, > -G8). */
typedef s32 (*FuncPtr_80049078)(s32);
extern FuncPtr_80049078 _D_80049078[3] __asm__("D_80049078");
#define D_80049078 _D_80049078

/* D_80049084 — u16 string at offset 0x0C past D_80049078 (func_8001A808 strcat source).
 * Content is 4 u16 (8B, 0x80049084..0x8004908B), but the target splits its address
 * (lui a1,%hi at 8001A850, addiu a1,a1,%lo in the next jal's delay slot at 8001A858),
 * which per ADR-0001 §1 requires a declared size > -G8 (≤8 would keep SYMBOL_REF_FLAG
 * set and leave the address a single unsplit macro that cannot straddle a delay slot).
 * The original TU therefore declared it >8B; [5]=10B keeps the split and the label's data
 * region is still the 8B splat defines. Verified: [3]=6B and [4]=8B both unsplit (24/26). */
extern u16 D_80049084[5];

/* D_80061EC8 — camera/reference position as s32[3], accessed with absolute
 * addressing (lui+lw). func_8001C1C0 reads all three elements. */
extern s32 _D_80061EC8[3] __asm__("D_80061EC8");
#define D_80061EC8 (_D_80061EC8)

/* D_80061EA8 — array of plane coefficients (s16), accessed with absolute
 * addressing (lui+lh). func_8001C1C0 reads 12 elements (4 planes × 3 components).
 * Array size 12 ensures >8 bytes for absolute addressing under -G8. */
extern s16 _D_80061EA8[12] __asm__("D_80061EA8");
#define D_80061EA8 (_D_80061EA8)

/* D_80010000 - function pointer table at start of code segment (2 entries).
 * Array size 3 forces >-G8 declared size for split absolute addressing (lui/addiu). */
typedef void (*InitFunc)(void);
extern InitFunc D_80010000[3];

/* D_8005F2E8 - OT ring buffer (0x100 bytes = 0x40 u32 entries; func_8001AFE0
 * zeroes a larger 0x1300-byte sprite render region starting here). Declared
 * >-G8 so cc1 materializes the address as a SPLIT lui/addiu pair (two RTL
 * insns). Under the generated 4-byte s32 declaration the address was a single
 * unsplit `la` macro and CSE folded the OT base into each ClearOTagR use,
 * destroying the callee-saved $s2 web func_8001B074 keeps (move a0,s2 /
 * addiu a0,s2,128 across four calls). Size class only; this TU never defines it. */
extern u32 D_8005F2E8[0x40];

/* D_8005F2B8 - SpriteSourceData instance (0x30 bytes). Declared >-G8 so cc1
 * materializes its address as a SPLIT lui/addiu pair in RTL, matching how the
 * original TU compiled it (target lui s1,%hi / addiu s1,%lo). The declared size
 * class feeds the local-allocator quantity structure (HIGH temp merges into the
 * base quantity); with a 4-byte declaration the address is an unsplit `la` macro
 * and the register quantity differs from the original, shifting the callee-saved
 * assignment. This TU never defines it. */
extern u32 D_8005F2B8[0xC];

/* D_800605F0 - SpriteDataHeader instance. Same split-address declaration class
 * as D_8005F2B8/D_8005F2E8; target reaches it with lui s0,%hi / addiu s0,%lo. */
extern u32 D_800605F0[0x10];

/* D_80049268, D_80049274, D_80049280 — absolute-addressed Vec3 globals
 * used by func_8001EFA4. Accessed with lui/lw (split absolute addressing).
 * Array size 3 (12 bytes) forces >-G8 declaration for split addressing. */
extern s32 _D_80049268[3] __asm__("D_80049268");
#define D_80049268 (_D_80049268[0])
extern s32 _D_80049274[3] __asm__("D_80049274");
#define D_80049274 (*((s32*)_D_80049274))
extern s32 _D_80049280[3] __asm__("D_80049280");
#define D_80049280 (*((s32*)_D_80049280))

/* D_80061EF8 — array of 3 pointers to vertex coordinate structs (s16 at 0, 2, 4).
 * Absolute addressing (lui/addiu). Array of 3 pointers = 12 bytes > -G8.
 * Used by func_8001E38C for hit-triangle vertex coordinates. */
typedef struct {
    s16 f0;
    s16 f2;
    s16 f4;
} Coord3;
extern Coord3 *_D_80061EF8[3] __asm__("D_80061EF8");
#define D_80061EF8 (_D_80061EF8)

/* D_8005E850 — VAB transfer state struct, same layout as D_8006C7B8.
 * func_80021668 copies D_8006C7B8 fields to offsets 0..0x1C here.
 * Array size 8 (32 bytes) forces >-G8 declaration for split absolute
 * addressing (lui/addiu with real register) matching the target. */
extern struct_8006C7B8 _D_8005E850[1] __asm__("D_8005E850");
#define D_8005E850 (*((struct_8006C7B8*)_D_8005E850))

/* D_80054BC0 - s32 triple read by func_8001A284 (case 15) with the split
 * two-register form `lui v0,%hi` / `lw a0,%lo(v0)`: declared size 12 bytes
 * (> -G8) so cc1 emits the split two-register address rather than the
 * <=-G8 self-clobber macro pair. Not classified in globals.h. */
extern s32 D_80054BC0[3];

/* D_80054BBC - s32 quad read by func_80024108 / func_80023D08 (grid-cursor
 * TU): split two-register address (`lui r,%hi` / `lw r2,%lo(r)` with
 * base register != load destination). Declared array size 16 bytes (> -G8)
 * so cc1 emits the split two-register form rather than the <=-G8
 * self-clobber macro pair. Not classified in globals.h. */
extern s32 D_80054BBC[4];

/* D_8005175C / D_80051768 - s32 scalars whose addresses func_8001A284
 * materializes with the unsplit `la` form (expanded by ASPSX to a
 * self-clobbering lui/addiu pair). D_8005175C declared as an array so its
 * size exceeds -G8: func_80024108's target materializes &D_8005175C with
 * the SPLIT two-insn form (lui %hi / addiu %lo as separate defs), which
 * cc1 only emits for a symbol classified >small data. */
extern s32 D_8005175C[4];
extern s32 D_80051768;

/* D_800517C6 - u8 table base in the PS-X EXE indexed by D_80054BBC[1]
 * (and +0x42) in ovl_11_func_80103EB8. Never defined in the overlays, so
 * cc1 materializes the address as the split lui/%lo pair. */
extern u8 D_800517C6[];

/* D_80061E28 - 0x20-byte u16 struct cleared with memset(&..,0,0x20) and
 * given u16 0x1000 writes at offsets 0x00/0x08/0x10 by func_8001B530.
 * Sibling objects at +0x20 (same 0x20 memset) are declared scalar s32 in
 * globals.h. Plain extern: within $gp range but never defined in this TU,
 * so cc1 emits the split absolute lui/%lo addressing the target shows. */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u16 field_4;
    /* 0x06 */ u16 field_6;
    /* 0x08 */ u16 field_8;
    /* 0x0A */ u16 field_A;
    /* 0x0C */ u16 field_C;
    /* 0x0E */ u16 field_E;
    /* 0x10 */ u16 field_10;
    /* 0x12 */ u16 field_12;
    /* 0x14 */ u16 field_14;
    /* 0x16 */ u16 field_16;
    /* 0x18 */ u16 field_18;
    /* 0x1A */ u16 field_1A;
    /* 0x1C */ u16 field_1C;
    /* 0x1E */ u16 field_1E;
} struct_80061E28;
extern struct_80061E28 D_80061E28;

/* D_80049068 / D_80049070 - u16 message tables read by func_8001A19C under
 * split absolute addressing (`lui %hi` / `addiu r,%lo` with the base in a
 * scratch register, not the self-clobber `la` pair). Declared as incomplete
 * arrays so cc1 leaves SYMBOL_REF_FLAG unset (size unknown > -G8) and emits
 * the split two-register address form matching the target. Not classified
 * in globals.h. */
extern u16 D_80049068[];
extern u16 D_80049070[];

/* D_800558A4 - card/colour table: 4 bytes per card value (two u16).
 * func_8002206C reads byte offsets 4*v and (4*v)|2 (lui+addiu absolute,
 * owned by the nonmatching data file, not classified in globals.h). */
extern u16 D_800558A4[80];

/* D_80055944 - per-stall position ranges: stall k uses the u16 entries
 * [4k..4k+3] as (lo, hi, lo, hi). Absolute-addressed, owned by the
 * nonmatching data file, not classified in globals.h. */
extern u16 D_80055944[24];

/* D_800B8500 - kanji-font init counter (ovl_08). ovl_08_func_800B8054 and
 * ovl_08_func_800B80FC increment it, ovl_08_func_800B8014 indexes a table with
 * it. Absolute-addressed (ovl_08 data, -G0): declared extern (8-byte s32)
 * here, never tentatively defined, so cc1 emits lui+sw/lw %lo. */
extern s32 D_800B8500;

/* D_800B8508 - Kanji font page table: 8-byte entries {glyph pointer, kanji
 * code}. ovl_08_func_800B8134 draws the six-entry page at entry D_800B8504/6*6
 * (walking .field_4, 1 entry per character) and reads .field_0 of the entry at
 * D_800B8504 when confirming a selection. Absolute-addressed (ovl_08 data,
 * -G0), owned by the nonmatching data file, not classified in globals.h. */
typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ s32 field_4;
} struct_800B8508;
extern struct_800B8508 D_800B8508[];

/* D_800B7EE8..D_800BB990 - ovl_10 memory-card editor globals
 * (Obj\gf_mcard.bin), used by ovl_10_func_800B95F0 and its matched siblings
 * (ovl_10_func_800B9AA8, ovl_10_func_800B9D24, ...). Absolute-addressed
 * (ovl_10 data, -G0); not classified in globals.h. Types derived from the
 * ovl_10_func_800B95F0 target: the format/heading strings are char[],
 * D_800BB810[5] is the 5-word save-slot table (words at 0/4/8/C/0x10 read
 * with lw and packed for McxGetMem), D_800BB90C is the card buffer, and the
 * D_800BB82X/D_800BB98C/D_800BB990 are the editor counters/predicate state.
 * The matched neighbor ovl_10_func_800B9D24 declares D_800B8328/D_800B8330/
 * D_800B8358/D_800B8360 locally with the same char[] type. */
extern char D_800B7EE8[];
extern char D_800B8280[];
extern char D_800B82AC[];
extern char D_800B82DC[];
extern char D_800B830C[];
extern char D_800B8328[];
extern char D_800B8330[];
extern char D_800B8340[];
extern char D_800B8358[];
extern char D_800B8360[];
extern char D_800B8368[];
extern char D_800B8370[];
/* Further editor strings and status words read/written by the mcard
 * slot/S/R/L button editor (ovl_10_func_800BADA4) and the block/cursor
 * editor ovl_10_func_800BB264.  The byte buffer D_800BBA4C is indexed as
 * (D_800BB8A4 + 1); D_800BBA40/D_800BBA44 hold the masked button word
 * (arg1 & 0xF000). */
extern char D_800B7E40[];
extern char D_800B86C4[];
extern char D_800B87C8[];
extern char D_800B87FC[];
extern char D_800B8840[];
extern char D_800B885C[];
extern char D_800B8868[];
extern char D_800B8878[];
extern char D_800B8884[];

/* ovl_31 memory-card directory listing.  D_800B7EF0 is the "*" name
 * pattern and D_800B7EF4 the "%d file(s) %d block(s)\n" format;
 * D_800B88B0 is the DIRENTRY buffer MemCardGetDirentry fills (the loop
 * reads its +0x18 size word at stride 0x28) and D_800B8B10 the sprintf
 * output buffer.  All are absolute-addressed from the overlay. */
struct DIRENTRY;
extern char D_800B7EF0[];
extern char D_800B7EF4[];
extern struct DIRENTRY D_800B88B0;
extern char D_800B8B10[];
extern s32 D_800BB8A4;
extern s32 D_800BB8A8;
extern s32 D_800BB8AC;
extern s32 D_800BB8B0;
extern s32 D_800BB8B4;
extern s32 D_800BB8B8;
extern s32 D_800BB8BC;
extern s32 D_800BB8C0;
extern s32 D_800BB8C4;
extern s32 D_800BB8C8;
extern s32 D_800BBA44;
extern s32 D_800BBA40;
extern unsigned char D_800BBA4C[];
extern unsigned int D_800BB810[5];
extern unsigned char D_800BB90C[];
extern s32 D_800BB824;
extern s32 D_800BB828;
extern s32 D_800BB82C;
extern s32 D_800BB830;
extern s32 D_800BB98C;
extern s32 D_800BB990;
/* The mcard write-device editor (ovl_10_func_800BA394).  D_800BB86C is a
 * five-word header the cursor D_800BB868 addresses with negative values
 * (-5..-1); D_800BB9BC is the 0xA0-byte payload it addresses with
 * non-negative ones, and D_800BB86C[4] is the live length of both.
 * D_800BB880..D_800BB88C are the four per-bit pad repeat counters, and
 * D_800BBA3C holds the masked button word — the same shape as D_800BBA40 and
 * D_800BBA44 above. */
extern char D_800B861C[];
extern char D_800B8644[];
extern char D_800B866C[];
extern char D_800B8694[];
extern char D_800B86BC[];
extern s32 D_800BB868;
extern s32 D_800BB86C[5];
extern s32 D_800BB880;
extern s32 D_800BB884;
extern s32 D_800BB888;
extern s32 D_800BB88C;
extern unsigned char D_800BB9BC[];
extern s32 D_800BBA3C;

/* Action sub-structure at 0x1C of ItemData (ovl_11_func_800D58D0): fn ptr at
 * +0 called as (s8, s8, s16, s32) -> s32, signed byte at +4, signed byte at
 * +5, s16 at +6. */
typedef struct {
    /* 0x00 */ s32 (*field_0)(s8 arg0, s8 arg1, s16 arg2, s32 arg3);
    /* 0x04 */ s8 field_4;
    /* 0x05 */ s8 field_5;
    /* 0x06 */ s16 field_6;
} ItemAction;

/* Shared item table entry (array behind the D_8006C858 pointer, stride 0x28).
 * Referenced by the ovl_11 item-cluster functions: the offset-0x00 word is
 * read both signed (lh: ovl_11_func_800D5868/800D589C/800D5750 bit tests
 * 0x40/0x8100/0x4000) and unsigned (lhu: e.g. 800C8764, 800CCF58, 800D6090),
 * so it is modelled as a union of both views; type byte at 0x02, s16 at
 * 0x10, status word at 0x18 (signed test + bitfield reads), and an action
 * sub-structure at 0x1C (s32 fn ptr at +0, bytes at +4/+5, s16 at +6). */
typedef struct {
    union {
        /* 0x00 */ u16 flags;
        /* 0x00 */ s16 field_00;
    } u0;
    /* 0x02 */ u8 type;
    /* 0x03 */ char pad_03[0x10 - 0x03];
    /* 0x10 */ s16 field_10;
    /* 0x12 */ char pad_12[0x18 - 0x12];
    /* 0x18 */ s32 field_18;
    /* 0x1C */ ItemAction action;
    /* 0x24 */ char pad_24[0x28 - 0x24];
} ItemData; /* 0x28 */

/* D_8006C858 - shared item table pointer (main-binary data, absolute addressed
 * from overlays that only declare it extern; stride 0x28 per ItemData). */
extern ItemData *D_8006C858;

/* D_801247E8 - 51-entry s32 delta table (0xCC bytes, 0x801247E8-0x801248B4).
 * Read as adjacent words by ovl_11_func_800E3978 (a delta lookup) and by
 * ovl_11_func_800E351C/800E36CC (sprite-map offsets). Absolute-addressed. */
extern s32 _D_801247E8[51] __asm__("D_801247E8");
#define D_801247E8 (*((s32 *)_D_801247E8))

/* D_800759E4 - shared field/stage-config struct (absolute-addressed from the
 * ovl_11 overlays, owned by the main EXE's data). Accessed at 0x00 (u16,
 * lhu by ovl_11_func_80108CD0), 0x34 (s32 flags word, func_800CF044 /
 * func_800EC064), and 0x30/0x38/0x3C/0x40 written by ovl_11_func_8010941C
 * per sub-state argument (0: 0x30=1,0x38=-0x708,0x40=0xC1C; 1:
 * 0x30=9,0x38=0xE6,0x40=-0x514). */
typedef struct {
    /* 0x00 */ u16 f00;
    /* 0x02 */ char pad_02[0x30 - 0x02];
    /* 0x30 */ u16 f30;
    /* 0x32 */ char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 f34;
    /* 0x38 */ s32 f38;
    /* 0x3C */ s32 f3C;
    /* 0x40 */ s32 f40;
} struct_800759E4;
extern struct_800759E4 _D_800759E4[1] __asm__("D_800759E4");
#define D_800759E4 (*((struct_800759E4 *)_D_800759E4))

/* D_80124A18 - table of 0x14-byte range-clamp entries (ovl_11).
 * Element stride 0x14; fields used: s16 low at +0x08 (lh read by
 * ovl_11_func_800EFD54), s32 high at +0x0C (lw read), s32 field at +0x10
 * (read by ovl_11_func_800EFABC). Absolute-addressed from the overlays
 * (only ever declared extern, never GP). */
typedef struct {
    /* 0x00 */ u8 *field_0;   /* lw read by ovl_11_func_800EFF04 */
    /* 0x04 */ u8 field_4;     /* lbu read by ovl_11_func_800EFF04 */
    /* 0x06 */ s16 field_6;    /* lh read by ovl_11_func_800EFF04 */
    /* 0x08 */ s16 field_8;
    /* 0x0A */ u8 pad_0A[0x2];
    /* 0x0C */ s32 field_C;
    /* 0x10 */ s32 field_10;   /* 0x14 stride */
} Ovl11RangeEntry;
extern Ovl11RangeEntry _D_80124A18[] __asm__("D_80124A18");
#define D_80124A18 ((Ovl11RangeEntry *)_D_80124A18)

/* D_80129560 - s32 table indexed by an s16 value (0x50 bytes, ovl_11).
 * Store via sw at (s16)index * 4 is done by ovl_11_func_800E8BA0;
 * load-side users ovl_11_func_800E6834/800E686C read lw at the same
 * s16-scale. Absolute-addressed from the overlays (only ever declared
 * extern, never GP). */
extern s32 _D_80129560[] __asm__("D_80129560");
#define D_80129560 ((s32 *)_D_80129560)

/* D_80127A9C - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127A9C, passed by address to ovl_11_func_800D04D4 from
 * ovl_11_func_8010A0E4. Absolute-addressed from the overlay. */
extern u8 D_80127A9C;

/* D_80127AAC - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127AAC (0x10 bytes after D_80127A9C), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010A254. Absolute-addressed from
 * the overlay. */
extern u8 D_80127AAC;

/* D_80127AB4 - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127AB4 (8 bytes after D_80127AAC), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010A30C. Absolute-addressed from
 * the overlay. */
extern u8 D_80127AB4;

/* D_80127AC0 - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127AC0 (12 bytes after D_80127AB4), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010A3C4. Absolute-addressed from
 * the overlay. */
extern u8 D_80127AC0;

/* D_80127AFC - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127AFC (0x10 bytes after D_80127AAC... 0x14 after D_80127AE8),
 * passed by address to ovl_11_func_800D04D4 from
 * ovl_11_func_8010ABAC. Absolute-addressed from the overlay. */
extern u8 D_80127AFC;

/* D_80127B0C - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127B0C (0x10 bytes after D_80127AFC), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010AC64. Absolute-addressed from
 * the overlay. */
extern u8 D_80127B0C;

/* D_80127B1C - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127B1C (0x10 bytes after D_80127B0C), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010AD1C. Absolute-addressed from
 * the overlay. */
extern u8 D_80127B1C;

/* D_80127D48 - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127D48 (0x2AC bytes after D_80127A9C), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010E2C4. Absolute-addressed from
 * the overlay. */
extern u8 D_80127D48;

/* D_80127D88 - overlay-local 16-bit state-table base in ovl_11 data at
 * 0x80127D88 (0x40 bytes after D_80127D48), passed by address to
 * ovl_11_func_800D04D4 from ovl_11_func_8010EA6C. Absolute-addressed from
 * the overlay. */
extern u8 D_80127D88;

/* D_801281D0 - overlay-local 10-byte (0xA-stride) record table in ovl_11
 * data at 0x801281D0, indexed by a signed s16 selector in
 * ovl_11_func_80113208 and copied field-by-field into a loaded object
 * record. Absolute-addressed from the overlay. */
extern u8 D_801281D0;

/* D_801295B0 - 11 halfword scratch buffer (0x16 bytes, ovl_11) that
 * ovl_11_func_800E8550 fills via func_8001A970 and then scans for the
 * 0xFFD blank marker (lh reads). Absolute-addressed from the overlay
 * (only ever declared extern, never GP). */
extern s16 D_801295B0;

/* D_80129FD8 - 12-halfword (0x18 byte) scratch buffer in ovl_11 data,
 * filled by ovl_11_func_800F8B4C via func_8001A970 (digit halfwords plus
 * a 0xFFFF terminator) and passed to func_80017B3C. Absolute-addressed
 * from the overlay; >8-byte declaration keeps the address split. */
extern s16 D_80129FD8[12];

/* D_80126E4A - s16 digit count / index in ovl_11 data at 0x80126E4A,
 * read by ovl_11_func_800F8B4C and cleared by ovl_11_func_800F6680.
 * Absolute-addressed from the overlay. */
extern s16 D_80126E4A;

/* D_80051B9A - base of a data table in the PS-X EXE, indexed by
 * D_80054BBC and passed to func_80017B3C by ovl_11_func_800FA6CC.
 * Only address-taken; absolute-addressed (split lui/%lo pair). */
extern u8 D_80051B9A[];

/* D_80051BF0 - base of a data table in the PS-X EXE, indexed by
 * D_80054BBC and passed to func_80017B3C by ovl_11_func_800F8B4C (and
 * ovl_11_func_8011775C). Only address-taken; absolute-addressed. */
extern u8 D_80051BF0[];

/* D_80074124 - 7x7 table of 8-byte entries (ovl_11), written by
 * ovl_11_func_800D7B00. Each entry holds two s16 set to 0x167, two spare
 * u8, and an s16 set to 0. Reads in func_800BF630 etc. use the s16 @0
 * (0894 lhu) and u8 @4. Absolute-addressed from the overlays. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ u8 unk5;
    /* 0x06 */ s16 unk6;
} Ovl11D124Entry;
extern Ovl11D124Entry D_80074124[7][7];

/* D_80071DFC - 25x45 table of 8-byte entries (ovl_11); row stride 0x168.
 * ovl_11_func_800D8FC8 walks all 25 rows x 45 entries and ovl_11_func_800DAF60
 * indexes it; absolute-addressed from the overlay. */
extern Ovl11D124Entry D_80071DFC[25][45];

/* D_800491C8 - six words written in two-argument triples by func_8001D648. */
struct struct_800491C8 {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ s32 unk10;
    /* 0x14 */ s32 unk14;
};
extern struct struct_800491C8 D_800491C8;

/* D_8005E340 - gp-relative pointer to a record whose u16 at +2 is cached
 * into D_8005E33A by func_80023774. */
struct struct_8005E340_target {
    /* 0x00 */ char pad_0[0x2];
    /* 0x02 */ u16 unk2;
};
extern struct struct_8005E340_target *D_8005E340;

/* D_800B9626 - ovl_28 state halfword tested by ovl_28_func_800B935C. */
extern s16 D_800B9626;

/* D_800B9628 - four-halfword record initialised by ovl_28_func_800B9328
 * (a0, a1, 0x50, 0x50 at +0/+2/+4/+6). */
typedef struct {
    s16 unk0;
    s16 unk2;
    s16 unk4;
    s16 unk6;
} Ovl28B9628View;
extern Ovl28B9628View D_800B9628;

/* D_800BAB0C - ovl_28 state halfword cleared by ovl_28_func_800B9328. */
extern s16 D_800BAB0C;

/* VWD0 - PSY-Q libgs vertical display resolution (libgs.h). Forward-declared
 * here because libgs.h is not self-contained. */
extern long VWD0;

/* HWD0 - PSY-Q libgs horizontal display resolution (libgs.h). Forward-declared
 * here because libgs.h is not self-contained. */
extern long HWD0;

/* D_800B9630 - 20-record (0xC stride) initialised by ovl_28_func_800B895C:
 * s32@+0 = 0, s16@+4 = 0, s32@+8 = VWD0 << 12. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ char pad_6[0x2];
    /* 0x08 */ s32 unk8;
} Ovl28B9630Record;
extern Ovl28B9630Record D_800B9630[];

/* D_800B9720 - zeroed object immediately after the D_800B9630 table
 * (0x800B9630 + 20*0xC); passed by address to func_80015EE8 by
 * ovl_28_func_800B8A20. */
extern u8 D_800B9720[];

/* D_800B93B4 - s32 frame-time delta set to 0x800 by ovl_28_func_800B8414 and
 * subtracted from a record's unk8 by ovl_28_func_800B8AA8. */
extern s32 D_800B93B4;

/* D_800B93AE/D_800B93B0/D_800B93B2 - ovl_28 halfword state cleared by
 * ovl_28_func_800B8414. Absolute-addressed (the TU only declares them), so
 * they are not defined here. */
extern s16 D_800B93AE;
extern s16 D_800B93B0;
extern s16 D_800B93B2;

/* D_800B93B8/D_800B93BC - ovl_28 word state set by ovl_28_func_800B8414
 * (1 and 0 respectively). */
extern s32 D_800B93B8;
extern s32 D_800B93BC;

/* D_800B9614 - ovl_28 callback slot installed by ovl_28_func_800B8414 with
 * the address of ovl_28_func_800B8478. */
extern void (*D_800B9614)(void);

/* D_800B9618 - ovl_28 callback slot installed by ovl_28_func_800B865C with
 * the address of ovl_28_func_800B86D8 (same array as D_800B9614). */
extern void (*D_800B9618)(void);

/* D_800B961C/D_800B9620/D_800B9624 - ovl_28 halfword/word state seeded by
 * ovl_28_func_800B7E80 (halfword, word, halfword). Absolute-addressed (the
 * TU only declares them). */
extern s16 D_800B961C;
extern s32 D_800B9620;
extern s16 D_800B9624;

/* D_800B93C0..D_800B93CE - ovl_28 halfword/word state cleared and seeded by
 * ovl_28_func_800B865C. Absolute-addressed (declared externally here). */
extern s32 D_800B93C0;
extern s16 D_800B93C4;
extern s16 D_800B93C6;
extern s16 D_800B93C8;
extern s16 D_800B93CA;
extern s16 D_800B93CC;
extern s16 D_800B93CE;

/* D_80070CF2 - s16 global used in overlay 11 button-check functions */
extern s16 D_80070CF2;

/* Partial global-object views and external storage used by the integrated
 * reconstruction batch. Field offsets are witnessed; unknown extents remain
 * unsized. Parameter views live in game_types.h. */
typedef struct {
    char pad_0[0x4];
    s16 unk4;
} Recon_func_80023710_Pointee0View;

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ char pad_24[0x04];
    /* 0x28 */ void *field_28;
} Recon_ovl_11_func_800D5D38_D8006C838Lookup;

typedef struct {
    /* 0x00 */ char pad_00[4];
    /* 0x04 */ s16 arr[18];
} Recon_ovl_11_func_800D5D38_D8006C838Row;

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ void *field_24;
} Recon_ovl_11_func_800D5ABC_D8006C838Lookup_800D5ABC;

typedef struct {
    char pad_0[0x5];
    s8 unk5;
} Recon_ovl_11_func_800C9E90_D_800A0728View;

typedef struct {
    char pad_0[0x4];
    u8 unk4;
    u8 unk5;
} Recon_ovl_11_func_800F7010_D_800A0728View;

typedef struct {
    u8 unk0;
    u8 unk1;
    s16 unk2;
} Recon_ovl_11_func_800FA31C_D80126F8CEntry;

extern Recon_ovl_11_func_800FA31C_D80126F8CEntry _D_80126F8C[1] __asm__("D_80126F8C");
#define D_80126F8C (*((Recon_ovl_11_func_800FA31C_D80126F8CEntry*)_D_80126F8C))

/* D_80126FD4 - 4-byte overlay table indexed by ovl_11_func_800FA600: a u8
 * state id, a u8 sub-state id, and a u16 added to the first coordinate. */
typedef struct {
    u8 unk0;
    u8 unk1;
    u16 unk2;
} Recon_ovl_11_func_800FA600_D80126FD4Entry;
extern Recon_ovl_11_func_800FA600_D80126FD4Entry D_80126FD4[];

/* D_80126E18 - ovl_11 table of 4 five-byte records, one unsigned byte per
 * field; indexed by D_80070CF2 only after it is bounded to < 4, so the table
 * is exactly 0x14 bytes. Fields are read as bytes (lbu) at offsets 0x0..0x4. */
typedef struct {
    u8 unk0;
    u8 unk1;
    u8 unk2;
    u8 unk3;
    u8 unk4;
} Recon_ovl_11_func_800F6118_D80126E18Entry;
extern Recon_ovl_11_func_800F6118_D80126E18Entry D_80126E18[];

extern s32 D_8005E3B0;

extern s16 D_80128800;

extern u8 D_8007BFF8[];

extern s32 D_80126E40;

extern s32 D_80126FE0;

extern s16 D_8012720C;

/* D_8012720E - u16 countdown timer decremented by ovl_11_func_800FEA00 and
 * compared as s16; runs 4,3,2 and wraps to 7 when it goes negative. */
extern u16 D_8012720E;

extern u16 D_80127212;

/* D_80127214 - 6-halfword threshold table (0x0000, 0x1770, 0x4650, 0x8CA0,
 * 0xFFFF, 0x0000) read by ovl_11_func_800FE068 (entries 1..3, absolute
 * addressing) and ovl_11_func_800FE3A0/ovl_11_func_800FE14C. */
extern u16 D_80127214[];

extern s16 D_80127222;

extern s16 D_80127226;

extern s16 D_8012722A;

/* D_80127220 - 5-entry table of 4-byte records walked by
 * ovl_11_func_800FC6A4: u8 at +0x00 (lbu), u8 at +0x01 (lbu), s16 at +0x02
 * (lh). Absolute-addressed from ovl_11 code; the separately labelled
 * D_80127222/D_80127226/D_8012722A halfwords are the unk2 field of entries
 * 0/1/2. */
typedef struct {
    /* 0x00 */ u8 unk0;
    /* 0x01 */ u8 unk1;
    /* 0x02 */ s16 unk2;
} Ovl11D80127220Entry;
extern Ovl11D80127220Entry D_80127220[];

/* D_80127234 - 4-entry table of 0xC-byte records walked by
 * ovl_11_func_800FC754: s32 unk0 at +0x00 (lw, passed as first argument),
 * s32 unk4 at +0x04 (lw, nonzero selects the entry), u8 unk8 at +0x08 and
 * u8 unk9 at +0x09 (lbu). Absolute-addressed from ovl_11 code; written by
 * ovl_11_func_800FB908 at +0x00/+0x04/+0x09. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ u8 unk8;
    /* 0x09 */ u8 unk9;
    /* 0x0A */ char pad_A[0x2];
} Ovl11D80127234Entry;
extern Ovl11D80127234Entry D_80127234[];

/* D_80127328 - 6-entry table of 8-byte records walked by
 * ovl_11_func_800FC8C8: s32 flag mask at +0x00 (lw, ANDed against the
 * D_8006C838+0x44F8 status word) and u8 argument at +0x04 (lbu). Two s32
 * words per entry (0x04/0x13, 0x08/0x12, 0x10/0x15, 0x20/0x11, 0x40/0x10,
 * 0x80/0x14 in the data section). Absolute-addressed from ovl_11 code. */
typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ u8 unk4;
    /* 0x05 */ char pad_5[0x3];
} Ovl11D80127328Entry;
extern Ovl11D80127328Entry D_80127328[];

/* D_8012A028 - s16 scratch passed by address to func_8001A970 and
 * ovl_11_func_800FC544 by the ovl_11 countdown-table routines. */
extern s16 D_8012A028;

extern u8 D_8012737C[];

extern u8 D_8012CE88[];

extern u8 D_8012CEB8[];

extern u8 D_8012D548[];

/* D_80051AA8 - base of a table in the D_80051xxx region; the s32 read from
 * D_80054BC0[0] is added to its address to form two pointers stored into the
 * ovl_11 D_8012D548 record (ovl_11_func_8011B210). Address taken only. */
extern u8 D_80051AA8[];

/* D_8012D52C - container-wide s32 busy/finished state flag of ovl_11, reset
 * by the 0x80114184 reset-stub family (see notes/file-groupings.md). */
extern s32 D_8012D52C;

extern s16 D_80128420;

extern u8 D_800C4BD0[];

extern s32 D_800BB4E4[];

extern u8 D_800BB710[];

extern u8 D_800BD848[];

extern u8 D_800BD758[];

extern u8 D_800BDA74[];

extern u8 D_800BD870[];

extern u8 D_800BFA90[];

extern s32 D_800C49F8[];

/* D_800C4A50 - s32 table indexed by a signed 16-bit index in
 * ovl_27_func_800BA130, which sign-extends and scales it (sll 16 / sra 14)
 * before an s32 load. Plain extern (never defined in this TU), so cc1 emits
 * the split absolute lui/addiu address the target shows. */
extern s32 D_800C4A50[];

/* D_800C4A60 - ovl_27 table of four 8-byte {s32 id; void *data;} records at
 * 0x800C4A60 (data/2E40.data.s). ovl_27_func_800BA814 clamps the s32 at
 * D_8006C838+0x18 into the entry index, memcpy's 0x1000 bytes from the
 * entry's data pointer to D_8006C838+0x1C(+6), then records the entry's id.
 * Plain extern (never defined in this TU), absolute-addressed (-G0). */
struct D800C4A60Entry {
    s32 field_0;
    void *field_4;
};
extern struct D800C4A60Entry D_800C4A60[];


/* D_800711C4 - main-EXE progress-counter record, absolute-addressed from the
 * ovl_11 overlays (-G0). ovl_11_func_800F3BCC increments a u16 entry selected
 * by arg and folds the return into the s32 at 0x34; ovl_11_func_800F3EF0
 * folds the pending half of the u16 array (entries 1..25 at 0xFE..0x12E) into
 * the counter half (entries 0..24 at 0x00..0x30) with a 999 clamp, clears the
 * pending entries, and folds the s32 at 0x130 into the s32 at 0x34. */
extern u16 D_800711C4[0x9A];

/* D_8012D060: four halfwords written by ovl_11_func_80108864 and read
 * by ovl_11_func_801089DC. Shared declaration for both sides. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
} Ovl11D060Fields;
extern Ovl11D060Fields D_8012D060;

/* D_8012D080 - ovl_11 absolute-addressed pointer cell (outside $gp range).
 * ovl_11_func_801098B0 passes its address as the out pointer of the
 * D_80075BC4 record scan and clears it to 0 when the scan fails;
 * ovl_11_func_80109E04 reads it as the current cluster record. */
extern s32 *D_8012D080;

/* D_80070D30 and D_800719F8 - the ovl_11 file-status flag word and its
 * status sibling (reached as &D_800719F8 - 0xCC8). Both are >8-byte-view
 * symbols accessed with absolute addressing (lui + %lo) from ovl_11 code. */
extern s32 D_80070D30;
extern s32 D_800719F8;

/* D_80127F80 - ovl_11 table of four halfwords scanned by
 * ovl_11_func_80112284 through an advancing s16 pointer.
 * Accessed with absolute addressing from ovl_11 code. */
extern s16 D_80127F80;

/* D_80127F88 - second ovl_11 table of four halfwords, scanned by
 * ovl_11_func_80112318 through an advancing s16 pointer. Sits just past
 * the D_80127F80 table. Accessed with absolute addressing from ovl_11
 * code. */
extern s16 D_80127F88;

/* D_80127F90 - third ovl_11 table of four halfwords, scanned by
 * ovl_11_func_801123AC through an advancing s16 pointer. Sits just past
 * the D_80127F88 table. Accessed with absolute addressing from ovl_11
 * code. */
extern s16 D_80127F90;

/* D_80074838 - large ovl_11 work-area base. Referenced with absolute
 * addressing from ovl_11 code; the card-table region this overlay clears
 * sits at +0x6520 (three rows of six 14-byte card records, also reached
 * as D_8007AD4E). */
extern u8 D_80074838[0x8000];

/* D_8007A3F0 - address inside the D_80074838 work area (base + 0x5BB8),
 * referenced absolutely (lui + %lo) by ovl_11_func_801129EC, which passes
 * its address to ovl_11_func_80112B60. Only the address is taken, so the
 * element type is not witnessed; u8 keeps the base/offset relation. */
extern u8 D_8007A3F0;

/* D_80123E04 - {s16,s16} bounds record indexed by a byte offset (arg3, an
 * s16 multiplied by 4) from ovl_11_func_800D806C. Absolute-addressed. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} struct_80123E04;
extern struct_80123E04 _D_80123E04[1] __asm__("D_80123E04");
#define D_80123E04 (*_D_80123E04)

/* D_801287CC - s16 threshold table (13 halfwords) walked with a stride-2
 * pointer by ovl_11_func_80121204. Absolute-addressed (lui + %lo) from
 * ovl_11 code. */
extern s16 D_801287CC[13];

/* ovl_11 farm-state globals. The six halfwords at D_8012CF10 are signed in
 * the reset and comparison functions; ovl_11_func_80103B24 reads their raw
 * bits as unsigned halfwords. All three globals are addressed absolutely. */
extern s16 D_8012CF10[7];
extern s32 D_8012CF20;
extern s32 D_80127428;

/* D_8012CF30 - 12-halfword (0x18 byte) ovl_11 scratch buffer filled by
 * func_8001A970 (0xFFFF terminator) and passed to func_80017B3C by
 * ovl_11_func_80103EB8 / ovl_11_func_80103F8C. Absolute-addressed. */
extern s16 D_8012CF30[12];

/* D_800BCC48 - ovl_21 table of six 4-byte {u16,u16} pairs (0xFD12/0xFD12,
 * 0x0000/0xFA24, 0x02EE/0xFC97, 0xFD12/0x02EE, 0x0000/0x05DC,
 * 0x02EE/0x02EE). ovl_21_func_800BAEEC indexes it by arg0*4 and loads both
 * halfwords with lhu, so both fields are unsigned. Absolute-addressed
 * (extern-only, lui + %lo) in the -G0 overlay build. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
} UnkStruct800BCC48;
extern UnkStruct800BCC48 D_800BCC48[];

/* D_800BCCD4 - ovl_21 table of s16 selector values (0x25/0x23/0x22/0x24 at
 * +0), indexed by a signed halfword read from the D_800C0448 state block.
 * ovl_21_func_800B90C4 loads it with lh, so it is signed. Absolute-addressed
 * (extern-only, lui + %lo) in the -G0 overlay build. */
extern s16 D_800BCCD4[];

/* D_800BCC60 - ovl_21 table of 25 4-byte voice-bit masks (0x1, 0x2, 0x4,
 * ... doubling to 0x800000, then a 0 terminator). ovl_21_func_800B93F0
 * indexes it by a signed halfword read from the D_800C0448 state block and
 * passes the loaded word to SpuGetKeyStatus as its voice_bit argument, so the
 * element type is u32. Absolute-addressed (extern-only, lui + %lo) in the -G0
 * overlay build. Not classified in globals.h. */
extern u32 D_800BCC60[];

/* D_800C0448 - two-halfword ovl_21 state. ovl_21_func_800B9538 writes the
 * first halfword, ovl_21_func_800B95EC clears the first and increments the
 * second. Unsigned halfwords: the increment target loads with lhu. All the
 * other ovl_21 references are unmatched stubs, so this type is the only one
 * the matched pair shares. Absolute-addressed (extern-only, lui + %lo). */
extern u16 D_800C0448[2];

/* D_800C0458 - ovl_21 object-state base at D_800C0448 + 0x10, the sub-view
 * handed to ovl_21_func_800BAE20. ovl_21_func_800BA510 walks it at stride
 * 0x108 and derives the record base (D_800C0458 - 0x10) and the projection
 * object (D_800C0458 + 0x6D4, which is the D_800C0B2C label) from it.
 * Absolute-addressed (extern-only, lui + %lo) in the -G0 overlay build. */
extern u8 D_800C0458[];

/* D_800BCD18 - ovl_21 four-halfword (SVECTOR-shaped) projection workspace.
 * ovl_21_func_800BAFFC writes vx/vy/vz and passes its address as the SVECTOR
 * argument of func_8001DFD4. Absolute-addressed; classified in globals.h as
 * an s16 scalar would be wrong width, so the aggregate lives here. */
extern s16 D_800BCD18[4];

/* D_800BCD20 - ovl_21 eight-byte projection result buffer. func_8001DFD4
 * writes the two sxy words at +0/+4 through an s32* and
 * ovl_21_func_800BAFFC reads their low halfwords. Absolute-addressed;
 * classified in globals.h as an s32 scalar would be wrong width, so the
 * buffer lives here. */
extern s32 D_800BCD20[2];

/* D_800C0AFC - ovl_21 object-state base (0x800C0AFC). ovl_21_func_800BAF70
 * passes its address to func_80015840 and reads the two bytes at +4/+5
 * through a base register biased to D_800C0AFC - 0x6B4. An opaque byte
 * object suffices; the overlay build is -G0, giving absolute lui/addiu
 * addressing. Not classified in globals.h. */
extern u8 D_800C0AFC[];

/* D_800C0DD8 - ovl_21 FuncC0D4Args descriptor whose address
 * ovl_21_func_800BB2B4 hands to func_8001C0D4. Only its address is taken, so
 * an opaque byte object is enough; the overlay build is -G0, giving absolute
 * lui/addiu addressing. Not classified in globals.h. */
extern u8 D_800C0DD8[];

/* D_80129230 - ovl_11 array of 10 records, stride 0x30. ovl_11_func_800E516C
 * walks it with a 0x30 byte pointer and reads the s32 at +0x14; the same
 * stride appears in ovl_11_func_800E4568. Absolute-addressed (extern-only,
 * lui + %lo). */
typedef struct {
    /* 0x00 */ char pad_00[0x14];
    /* 0x14 */ s32 unk14;
    /* 0x18 */ char pad_18[0x18];
} Ovl11E5230Entry; /* 0x30 */
extern Ovl11E5230Entry _D_80129230[] __asm__("D_80129230");
#define D_80129230 ((Ovl11E5230Entry *)_D_80129230)

/* D_80129410 / D_80129412 - ovl_11 signed halfword display bounds read by
 * the ovl_11 sprite helpers (ovl_11_func_800E516C and ovl_11_func_800E4BA4)
 * and passed as four of the five arguments to func_80015868 /
 * func_80017240. Absolute-addressed (extern-only, lui + %lo). */
extern s16 D_80129410;
extern s16 D_80129412;

/* D_8006C904 - byte state written by the func_800226F0/func_80022B20/
 * func_80022D70 cluster (values 0/4/6) and read by
 * ovl_11_func_800E6AB0 as a plain zero/non-zero test. The original read is
 * `lbu`, so the byte is unsigned: the generated scalar default is s8 and
 * would emit `lb`. Absolute-addressed (lui + %lo). */
extern u8 _D_8006C904[9] __asm__("D_8006C904");
#define D_8006C904 (*((u8*)_D_8006C904))

/* D_80123A00 - ovl_11 table of u16 entries read by ovl_11_func_800D062C
 * with a computed index and `lhu`. Declared as an incomplete array (unknown
 * size > -G8) so cc1 emits the split two-register absolute address form
 * (`lui`/`addiu %lo` with a real register) the target shows, not the
 * <=-G8 self-clobber macro pair. Extern-only; the overlay data owns it. */
extern u16 D_80123A00[];

/* D_80123758 - ovl_11 table of 0x18-byte records (17 entries), scanned by
 * ovl_11_func_800CF258 and ovl_11_func_800CF428. Field 0x0 is an s16 id
 * (compared against item ids), field 0x4 is a u16 mask ANDed with the
 * sign-extended ovl_11_func_800D2E20() result. Absolute-addressed
 * (lui + %lo, split two-register form): declared as an aggregate wider
 * than -G8 so cc1 emits the split address, and owned by the ovl_11 data
 * image (this TU only declares it). */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ char pad_06[0x08 - 0x06];
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ char pad_10[0x18 - 0x10];
} Ovl11ItemEntry; /* 0x18 */
extern Ovl11ItemEntry D_80123758[];

/* D_80128818 - ovl_11 FuncC0D4Args descriptor whose address
 * ovl_11_func_800DB904 hands to func_8001C0D4. Only its address is taken, so
 * an opaque byte object is enough; the overlay build is -G0, giving absolute
 * lui/addiu addressing. */
extern u8 D_80128818[];

/* D_800BF700 - ovl_19 FuncC0D4Args descriptor whose address
 * ovl_19_func_800BB4D4 hands to func_8001C0D4. Only its address is taken, so
 * an opaque byte object is enough; the overlay build is -G0, giving absolute
 * lui/addiu addressing. */
extern u8 D_800BF700[];

/* D_800C0454 - ovl_25 FuncC0D4Args descriptor whose address
 * ovl_25_func_800BAC28 hands to func_8001C0D4. Only its address is taken, so
 * an opaque byte object is enough; the overlay build is -G0, giving absolute
 * lui/addiu addressing. */
extern u8 D_800C0454[];

/* D_800C030C - ovl_25 signed halfword state word. ovl_25_func_800B81F4
 * loads it (lh) and, when it is not -1, passes it to func_8001FAE8.
 * Absolute-addressed (lui + lh %lo) from ovl_25 code; the object lives in
 * the overlay data segment, so only an extern declaration belongs here. */
extern s16 D_800C030C;

/* D_801227F8 - ovl_11 pair table indexed by an s32 argument in
 * ovl_11_func_800BD1BC; entries are {start, end} s32 pairs. Defined in the
 * overlay data segment, so only an extern declaration belongs here. */
extern s32 D_801227F8[];

/* D_8007F7F8 - main-RAM destination buffer written by ovl_11_func_800BD1BC's
 * memcpy. Address comes from undefined_syms_auto.txt. */
extern s32 D_8007F7F8;

/* D_80137830 / D_80137A30 - ovl_15 checksum buffers. Absolute-addressed
 * (lui + %lo) from ovl_15 code; this TU family only declares them. The
 * target ovl_15_func_80135AE0 checksums 127-byte records at 0x80 stride
 * into byte 0x7F of each record, and reads D_80137A30 separately. */
extern u8 D_80137830[];
extern u8 D_80137A30[];

/* D_80126F7C / D_80126F80 / D_80126F88 - ovl_11 state words. Written by
 * ovl_11_func_800F9D3C / 800F9D5C and the 800F9F58 state handler, and read
 * back by the same run. Absolute-addressed (lui + %lo) in ovl_11 code; they
 * live in the overlay data segment, so only extern declarations belong here. */
extern s32 D_80126F7C;
extern s32 D_80126F80;
extern s32 D_80126F88;

/* D_801287F8 - ovl_11 pointer slot written by ovl_11_func_800BD938, which
 * stores D_8005E3B0 + 0x4290 into it (absolute lui + sw %lo). Defined in the
 * overlay data segment, so only an extern declaration belongs here. */
extern u16 *D_801287F8;

/* D_80128E08 - fifteen 0x30-byte entries. Byte storage keeps the existing
 * partial views compatible; each client casts to its witnessed layout. */
extern u8 D_80128E08[15 * 0x30];

/* D_801290D8 - three 0x34-byte overlay entries walked by ovl_11 
   func_800DCECC and ovl_11_func_800DCF10. Byte storage keeps the existing 
   partial views compatible; each client casts to its witnessed layout. */
extern u8 D_801290D8[3 * 0x34];

/* D_801291A8 - pair of pointers to 0x30-byte overlay entries. Set by
 * ovl_11_func_800DDC64, whose loop indexes the pair by bit 0 of an entry's
 * 0x28 halfword; ovl_11_func_800DDD18 clears/sets bit 0x1000 of the two
 * chosen entries' 0x28 halfwords. Absolute-addressed in ovl_11 code. */
extern u32 D_801291A8[2];

/* D_800BFC90 - ovl_23 sound/state block. Absolute-addressed (lui + %lo) from
 * ovl_23 code; ovl_23_func_800B8104 reads a signed halfword at +0 and compares
 * it against -1, while ovl_23_func_800B9454 stores a word at +0 and halfwords
 * at +4/+8/+0xA (+0x1B4). Declared as the halfword this TU observes; the
 * object lives in overlay RAM, so only an extern declaration belongs here. */
extern s16 D_800BFC90;

/* ovl_19 initialiser tables. Absolute-addressed (lui + %lo) from ovl_19 code;
 * they live in the overlay data segment, so only extern declarations belong
 * here. D_800BCEF0 is a u16 table of 0..5 at 0x800BCEF0; D_800BCF0C is a table
 * of 8-byte {s16 x4} records; D_800BF4C0 is the flat s16 display/state array
 * that the ovl_19 initialiser walks. D_800BCEE8 is a u16 table of four
 * halfwords read with an (entry[4] + 1) index by ovl_19_func_800B847C;
 * D_800BCEFC is the flat s16 source array that function copies 8-byte records
 * out of. */
extern s16 D_800BF4C0[];
/* D_800BF4E0 - the s16 field at D_800BF4C0 + 0x20, addressed by ovl_19_func_800B8DE8
 * through its own symbol (the compiler materialises D_800BF4E0 and expresses the
 * neighbouring D_800BF4C0 accesses as negative displacements from it). */
extern s16 D_800BF4E0[];
extern u16 D_800BCEF0[];
extern s16 D_800BCF0C[];
extern u16 D_800BCEE8[];
extern s16 D_800BCEFC[];

/* D_8006E910 - base of a 0xCE-entry array of 0x10-byte records (ovl_11).
 * ovl_11_func_800E9C34 walks it with a +0x10 stride comparing the cursor
 * returned by ovl_11_func_800E3A94 against each entry and reads the u8 at
 * +0x2; ovl_11_func_800E499C memcpys into it. Absolute-addressed (outside the
 * -G8 small-data window); only ever declared extern, never GP. */
typedef struct {
    /* 0x00 */ u8 unk0;
    /* 0x01 */ u8 unk1;
    /* 0x02 */ u8 unk2;
    /* 0x03 */ u8 unk3[0xD];
} Ovl11E910Entry;
extern Ovl11E910Entry _D_8006E910[] __asm__("D_8006E910");
#define D_8006E910 ((Ovl11E910Entry *)_D_8006E910)

/* ovl_19_func_800BAC9C slot-programming globals. The function installs a
 * set/clear callback into D_800BD07C and walks two ovl_19 data arrays
 * (D_800BF570 with stride 0x40, D_800BF4E8 with stride 0x48), applying the
 * callback to the u16 at each slot. All three live in overlay RAM and are
 * absolute-addressed (overlay build is -G0), so only extern declarations
 * belong here. */
extern u8 D_800BF570[];
extern u8 D_800BF4E8[];
extern void (*D_800BD07C)(u16 *arg0, s32 arg1);

/* D_80015814 / D_80015828 - the main-EXE bit set/clear helpers under the
 * names the ovl_19 overlay actually references (undefined_syms_auto.txt lines
 * 1-2 map D_80015814/D_80015828). ovl_19 cannot name the main binary's
 * func_80015814 symbol, so the source references the D_ names and takes their
 * addresses as callback values. Both take a u16 slot and a bit mask. */
extern void D_80015814(u16 *arg0, s32 arg1);
extern void D_80015828(u16 *arg0, s32 arg1);

/* D_80075AEA - ovl_11 signed halfword state, loaded with lh by
 * ovl_11_func_8010BBA8 (range-tested against 9 and 0xC9). */
extern s16 D_80075AEA;

/* D_80075AD4 - ovl_11 u16 flag, loaded with lhu (absolute access) by
 * ovl_11_func_8010B1C4, which tests it for zero and passes its address
 * to ovl_11_func_8010B778. */
extern u16 D_80075AD4;

/* D_801285F4 - ovl_11 table of 4 entries with 0xE-byte stride walked by
 * ovl_11_func_80120358. Each entry holds an s16 min at +0, an s16 max at +2
 * and five s16 values at +4. Absolute-addressed (overlay build is -G0), only
 * ever declared extern. */
typedef struct {
    /* 0x00 */ s16 min;
    /* 0x02 */ s16 max;
    /* 0x04 */ s16 vals[5];
} Ovl11D1285F4Entry;
extern Ovl11D1285F4Entry D_801285F4[4];

/* D_8012862C - ovl_11 u16 table indexed by the s32 field at +8 of the object
 * passed to ovl_11_func_80120358 (lhu load, s16-scale). Absolute-addressed. */
extern u16 D_8012862C[6];

/* D_80070D02 - ovl_11 s16 selector compared against the min/max bounds by
 * ovl_11_func_80120358 (lh load). Absolute-addressed. */
extern s16 D_80070D02;

/* D_800A04B8 - ovl_11 record table, one row of 9 entries of 0x1E bytes.
 * D_800A0494 is the 9-s16-per-row grid ending 0x24 below it; D_800A04B8 is
 * the row-relative view the record scan walks (ovl_11_func_800D678C indexes
 * D_800A04B8[arg0], ovl_11_func_800D666C walks 9 entries stepping +0x1E).
 * Absolute-addressed from the overlay. */
typedef struct {
    /* 0x00 */ char unk[0x18];
    /* 0x18 */ s16 unk18;
    /* 0x1A */ char pad[4];
} Ovl11A04B8Entry;
extern Ovl11A04B8Entry D_800A04B8[][9];

/* ovl_11 four-entry state dispatch table. The original rodata entries point
 * to ovl_11_func_800E3DC8/800E40CC/800E4280/800E4330; the dispatcher
 * preserves the selected handler's return value across its final flag clear. */
extern s32 (*D_800B9920[4])(void);

/* First 20-entry stride-4 queue: D_8006C838 + 0x49E4. The full-queue
 * path in ovl_11_func_800F27B0 shifts 0x4C bytes within this 0x50-byte span. */
extern u8 D_8007121C[0x50];
/* Adjacent second 20-entry queue selected by ovl_11_func_800F2880. */
extern u8 D_8007126C[0x50];

/* Object pointer and low flag-word cache written by ovl_11_func_800BF450. */
extern u32 *D_80128808;
extern u32 D_8012880C;

/* ovl_11 reset-run halfwords, initialized by 8011F52C and rewritten by
 * 8011F574. Their signed storage views agree with the matched reset leaf. */
extern s16 D_80128540;
extern s16 D_8012855A;

/* ovl_11 state buffer: 80112D10 clears its +C ten-byte flags, +16
 * 10x10x10 byte grid, initial halfword and word at +400. */
extern u8 D_8012D110[];

/* ovl_11 24-byte scratch span (six words) at 0x80129FF0: func_8001A970
 * fills a halfword through a returned pointer into it and ovl_11
 * functions pass its address as an argument buffer. Absolute-addressed
 * from the overlay. */
extern s16 D_80129FF0;

/* ovl_11 indexed halfword table indexed by ovl_11_func_800D0DCC: the target
 * computes 0x15 - obj->unkB2 and stores 0xFFFF through func_8001A970's
 * returned pointer into this table. Absolute-addressed from the overlay. */
extern s16 D_80128D70;

/* D_800B96BC - ovl_11 dispatch table of 19 function-pointer slots (0x4C
 * bytes, absolute-addressed). ovl_11_func_800E2824 indexes it by an s16 id,
 * tests a slot against NULL and calls through it with the id's object. The
 * rodata run at 0x800B96BC holds ovl_11_func_800E2C64/800E2D3C/800E2E4C/
 * 800E2E98 at slots 3/4/8/14. */
typedef s32 (*Ovl11B96BCFunc)(u16 *);
extern Ovl11B96BCFunc _D_800B96BC[19] __asm__("D_800B96BC");
#define D_800B96BC _D_800B96BC

/* D_800B970C - ovl_11 dispatch table of 20 function-pointer slots (0x50
 * bytes, absolute-addressed). ovl_11_func_800E2824 indexes it by the same
 * s16 id and only tests the slot against NULL. */
extern s32 _D_800B970C[20] __asm__("D_800B970C");
#define D_800B970C _D_800B970C

/* D_800C4A2C - ovl_27 halfword state counter at 0x800C4A2C. Read
 * unsigned to increment and signed to threshold-test; absolute-addressed
 * (overlay build is -G0). */
extern s16 D_800C4A2C;

/* D_800C4A80 - ovl_27 SpriteSourceData block (0x30 bytes) at 0x800C4A80.
 * Only its address is taken (passed to func_80015BF0/func_80015840), so an
 * opaque byte object suffices; absolute-addressed from the overlay. */
extern u8 D_800C4A80[];

#endif /* GLOBALS_OVERRIDE_H */

