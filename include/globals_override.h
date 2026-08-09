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

/* Forward declaration - defined in game_types.h */
struct GfxObj;

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

/* D_80055988 - s16 array accessed with absolute addressing (lui+addiu+lh)
 * Index: (s16)arg. Array size of 5 ensures >8 byte declaration for absolute addressing */
extern s16 D_80055988[5];

/* D_80049044 - u16 array accessed with lhu at index*2 (func_80019070)
 * Array size of 6 ensures >8 byte declaration for absolute addressing (lui+addiu) */
extern u16 D_80049044[6];

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
 *     pointers from the array at 0x80061EF8 and calls func_80038674
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

/* D_8005E540, D_8005E550, D_8005E554, D_8005E560 - GP-relative s32 scalars
 * Accessed by func_8001FF98 with sw %gp_rel */
extern s32 D_8005E540;
extern s32 D_8005E550;
extern s32 D_8005E554;
extern s32 D_8005E560;

/* D_8005E44C - GP-relative s16 scalar (loaded with lh by func_80017AA0) */
extern s16 D_8005E44C;

/* D_8005E47A - signed halfword (lh) — func_80019030 owns it */
extern s16 D_8005E47A;

/* D_8005E444 - unsigned halfword (lhu) — func_80019030 owns it */
extern u16 D_8005E444;

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
    /* 0x000 */ char pad_0[0x118];
    /* 0x118 */ s32  field_118;
} struct_8005E3C0;
extern struct_8005E3C0 *D_8005E3C0;

/* D_8005E438 - GP-relative u16, sprite tile/entry ID storage */
extern u16 D_8005E438;

/* D_8005E5B4, D_8005E5CC - GP-relative s32 scalars (func_80022738) */
extern s32 D_8005E5B4;
extern s32 D_8005E5CC;

/* D_8001009C, D_8005E328 - absolute s32 scalars (func_80011370 / func_8001205C)
 *
 * Scalars, not arrays. Addressing mode does not follow from the declared size:
 * a translation unit that does not define the symbol addresses it absolutely
 * whatever its size. The size decides only whether cc1 splits the address, and
 * <= -G8 leaves the unsplit macro form that the assembler expands into the
 * single-register lui/lw pair these two targets use. Over-declaring either
 * past the threshold forces the two-register split form and stops the match. */
extern s32 D_8001009C;
extern s32 D_8005E328;

/* D_800100A0 - string embedded in func_80010000 at offset 0xA0 ("INIT ERROR\n")
 * Referenced by func_80015704 for FntPrint error messages.
 * s32 array of 3 forces >8 byte declaration for absolute addressing (lui+lw) */
extern s32 _D_800100A0[3] __asm__("D_800100A0");
#define D_800100A0 ((char*)_D_800100A0)

/* D_8005E9C8, D_8005EA18 - pad state buffers accessed with absolute addressing
 * (lui+addiu). Array size 3 forces >8-byte declaration to avoid GP-relative
 * small-data addressing under -G8. Evidence: func_80014064 target uses
 * lui/addiu for both symbols, not %gp_rel. */
extern s32 _D_8005E9C8[3] __asm__("D_8005E9C8");
#define D_8005E9C8 (*((s32*)_D_8005E9C8))
extern s32 _D_8005EA18[3] __asm__("D_8005EA18");
#define D_8005EA18 (*((s32*)_D_8005EA18))

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
 * Accessed at offsets 0x0..0x19A via absolute lui/addiu base in $s0.
 * Array size forces >8-byte declaration for absolute addressing under -G8. */
extern s32 _D_8005E5E8[104] __asm__("D_8005E5E8");
#define D_8005E5E8 (*((s32*)_D_8005E5E8))

/* D_8005E5D8 — pointer toggled between two buffer bases (func_80011370).
 * Target uses absolute lui/lw addressing. Array size forces >8 bytes. */
extern s32 _D_8005E5D8[3] __asm__("D_8005E5D8");
#define D_8005E5D8 (*((s32*)_D_8005E5D8))

#endif /* GLOBALS_OVERRIDE_H */
