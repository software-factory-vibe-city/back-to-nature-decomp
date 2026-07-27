#include "common.h"
#include "game_types.h"

/* POLY_F4 primitive initializer (PSY-Q helper family; siblings at
 * func_8001526C, func_8001530C, func_800153BC (POLY_G4), func_80015594
 * (TILE)).  Sets len/code, RGB, the semitransparent code variant, the four
 * vertices, links the primitive into the ordering table, and returns the
 * next primitive slot.
 * See extensive documentation captured here: ./notes/research/func_800154CC-polyf4-diamond-crossjump.md
 *  before continuing investigation */
void* func_800154CC(Struct_800154CC *arg0, s32 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7) {
    s32 mask;
    s32 temp_v0;
    s32 temp_v1;
    s32 var_v0;

    arg0->field_3 = 5;
    arg0->field_7 = 0x28;
    arg0->field_4 = (s8)(arg6 >> 0x10);
    arg0->field_5 = (s8)(arg6 >> 8);
    arg0->field_6 = (s8)arg6;
    /* The code byte is stored in both branches through the shared var_v0.
     * This is required for the target's branch shape: the two stores are
     * identical (same pseudo), so the crossjump pass merges them into one
     * store at the join, leaving the uncollapsed diamond
     * (beqz / j+li v0,42 / li v0,40 / sb v0,7(t0)).  A single store after
     * the if/else instead lets jump.c's "if (...) x = a; else x = b;"
     * transform hoist the else constant before the branch. */
    if (arg7 != 0) {
        var_v0 = 0x2A;
        arg0->field_7 = (s8)var_v0;
    } else {
        var_v0 = 0x28;
        arg0->field_7 = (s8)var_v0;
    }
    mask = 0xFFFFFF;
    temp_v1 = arg2 + arg4;
    temp_v0 = arg3 + arg5;
    arg0->field_C = (s16)temp_v1;
    arg0->field_14 = (s16)temp_v1;
    arg0->field_8 = arg2;
    arg0->field_A = arg3;
    arg0->field_E = arg3;
    arg0->field_10 = arg2;
    arg0->field_12 = (s16)temp_v0;
    arg0->field_16 = (s16)temp_v0;
    temp_v1 = (*(s32 *)arg0 & 0xFF000000) | (*arg1 & mask);
    *(s32 *)arg0 = temp_v1;
    *arg1 = (*arg1 & 0xFF000000) | ((s32)arg0 & mask);
    return (void *)((char *)arg0 + 0x18);
}
