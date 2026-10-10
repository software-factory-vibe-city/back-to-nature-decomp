#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
    /* 0x00 */ char pad_0[0x4];
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ char pad_8[0x4];
    /* 0x0C */ s32 unkC;
    /* 0x10 */ char pad_10[0x14];
    /* 0x24 */ VECTOR pos;
} Ovl11CC6A8Arg;

s32 ovl_11_func_800D7EF8(s32 *arg0, u16 *arg1, u16 *arg2);
s32 ovl_11_func_8011E090(VECTOR *pos, u16 *colOut, u16 *rowOut);

/* Queries the cell at the current stage mode's record bank (the s16 at
 * D_8007AFF0 + 0x25476). Mode 1 asks ovl_11_func_800D7EF8 for a column/row
 * into D_80071DFC; a second read finding mode 6 asks ovl_11_func_8011E090
 * for a column/row into D_80074124. A successful query resets unk4/unk6 to 1
 * and unkC to 0 and returns 0; a missing cell returns 2.
 *
 * The second mode read uses its own base pointer: reusing far_base makes it a
 * two-set variable whose lo_sum sched1 no longer boosts, and the %hi copy
 * then misses $a0.
 *
 * The shared store1 block declares its own result r instead of a function-wide
 * variable. r is born before the constant 1, so local-alloc gives the longer
 * live range r = $v0 and the constant = $v1; a function-wide result variable
 * is a global allocno, local-alloc hands the constant $v0 first, and the
 * return lands in $v1 with an extra move.
 */
s32 ovl_11_func_800CC6A8(Ovl11CC6A8Arg *arg0) {
    u16 col;
    u16 row;
    s16 mode;
    u16 *cell;
    char *far_base;
    char *far_base2;

    cell = NULL;
    far_base = (char *)&D_8007AFF0;
    mode = *(s16 *)(far_base + 0x25476);
    if (mode == 1) {
        if (ovl_11_func_800D7EF8((s32 *)((u8 *)arg0 + 0x24), &col, &row) != 0) {
            arg0->unk6 = mode;
            arg0->unk4 = mode;
            arg0->unkC = 0;
            return 0;
        }
        cell = (u16 *)&D_80071DFC[(s16)row][(s16)col];
    }
    far_base2 = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base2 + 0x25476) == 6) {
        if (ovl_11_func_8011E090((VECTOR *)((u8 *)arg0 + 0x24), &col, &row) != 0) {
            goto store1;
        }
        cell = (u16 *)&D_80074124[(s16)row][(s16)col];
    }
    if (cell == NULL) {
        return 2;
    }
    {
        s32 r;
store1:
        r = 0;
        arg0->unk6 = 1;
        arg0->unk4 = 1;
        arg0->unkC = 0;
        return r;
    }
}
