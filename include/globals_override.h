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

/* D_8006C7B8 - absolute-addressed struct accessed at offsets 0x0, 0xC, 0x10, 0x14, 0x18, 0x1C */
typedef struct {
    s32 unk0;       /* 0x00 */
    char pad[0x8];  /* 0x04-0x0B */
    s32 unkC;       /* 0x0C */
    s32 unk10;      /* 0x10 */
    s32 unk14;      /* 0x14 */
    s32 unk18;      /* 0x18 */
    s32 unk1C;      /* 0x1C */
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

/* D_8005E3A8 and D_8005E3AC - graphics display object pointer arrays
 * These appear to be double-buffered display/draw environments.
 * Array size of 3 ensures >8 byte declaration for absolute addressing (lui+lw) */
extern struct GfxObj *D_8005E3A8[3];
extern struct GfxObj *D_8005E3AC[3];

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

/* D_80049050 - array used by func_80017A70
 * Array size of 5 ensures >8 byte declaration for absolute addressing (lui+addiu) */
extern u16 D_80049050[5];

/* D_8005E43C - GP-relative update flag */
extern s32 D_8005E43C;

/* D_8005E44C - GP-relative u16 scalar */
extern u16 D_8005E44C;

/* D_8005E47A - used as signed halfword (lh) */
extern s16 D_8005E47A_s __asm__("D_8005E47A");

/* D_8005E025 - byte table accessed with absolute addressing (lui+addiu+lbu)
 * Array of 9 bytes ensures >8 byte declaration for absolute addressing */
extern u8 D_8005E025[9];

/* D_8005F0C8 - s32 array indexed by (value & 0xFFF), accessed with lui+addiu+lw
 * Array size ensures >8 byte declaration for absolute addressing */
extern s32 D_8005F0C8[4096];



/* D_8005E870 - struct accessed with sb at offsets 0x36 and 0x37 */
typedef struct {
    char pad[0x36];     /* 0x00-0x35 */
    u8 field_36;        /* 0x36 */
    u8 field_37;        /* 0x37 */
} struct_8005E870;
extern struct_8005E870 _D_8005E870[1] __asm__("D_8005E870");
#define D_8005E870 (*((struct_8005E870*)_D_8005E870))

/* D_80061F08 - struct used by func_8001FE00
 * Fields at 0x04, 0x0C, 0x10 - size at least 0x14 (20 bytes) for absolute addressing */
typedef struct {
    char pad[4];        /* 0x00-0x03 */
    s32 field_04;       /* 0x04 */
    char pad2[4];       /* 0x08-0x0B */
    s32 field_0C;       /* 0x0C */
    s32 field_10;       /* 0x10 */
} struct_80061F08;
extern struct_80061F08 _D_80061F08[1] __asm__("D_80061F08");
#define D_80061F08 (*((struct_80061F08*)_D_80061F08))

#endif /* GLOBALS_OVERRIDE_H */
