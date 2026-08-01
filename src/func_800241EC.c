#include "common.h"

/*
 * func_800241EC — D-pad cursor movement on a 14-column grid (byte-verified).
 *
 * Called by func_80023DBC. Companion default handler: func_800243D0
 * (address-adjacent; likely same TU).
 *
 * arg0: packed 16-bit cursor position; col = arg0 % 14 (sp10),
 *   row = arg0 / 14 (sp14). Both stored masked to 16 bits.
 * arg1: pad button mask, one of {0x1000, 0x2000, 0x4000, 0x8000}
 *   (PSX digital pad Up/Right/Down/Left) -> var_a3 {0, 3, 2, 1}:
 *   bit 0 = axis (1 = horizontal/column move), bit 1 = direction
 *   (set = increment).
 * arg2: table-set index, must be < 2; indexes the parallel arrays
 *   D_80055994 / D_800559BC (bounds byte-table bases) and D_800559C4
 *   (handler function pointers).
 *
 * Horizontal move: bound = D_80055994[arg2][row] (max column per row),
 *   handler from D_800559C4[arg2], moves sp10 (column).
 * Vertical move: bound = D_800559BC[arg2][col] (max row per column),
 *   handler = func_800243D0, moves sp14 (row).
 * The moved coordinate wraps: below 0 -> bound; above bound -> 0. The
 * handler's return value then replaces it, and the repacked position
 * ((u16)col + row * 14) & 0xFFFF is returned.
 *
 * Matching-critical shapes (do not "simplify"):
 * - The & 0xFFFF masks on both division results are real source
 *   constructs (two extra andi pseudos with short lives); dropping them
 *   rotates the whole register allocation.
 * - The vertical-path table index is sp10, NOT arg1: at 0x242E8 the
 *   target's $a1 was redefined at 0x2427C to the masked remainder. A
 *   previous attempt misread this; the wrong source coincidentally also
 *   emitted addu with $a1, so masked diffs could not expose it.
 * - Increment/decrement reads *var_s0 once into v before the branch and
 *   stores v +/- 1 in each arm (cross-jumping merges the stores).
 * - Branch statement order matches the target's emission order: taken
 *   branch = table read, handler pointer, var_s0; else branch = var_s0,
 *   table read, handler pointer. Birth order drives the global
 *   allocator's priority queue; reordering reintroduces a spurious
 *   move t0,a2 at entry.
 */

s32 func_800243D0(s32, s32, s32);

s32 func_800241EC(s32 arg0, s32 arg1, u32 arg2) {
    s32 sp10;
    s32 sp14;
    s32 temp_a0;
    s32 temp_a1;
    s32 temp_t1;
    s32 var_a3;
    s32 *var_s0;
    s32 (*var_a3_2)(s32, s32, s32);
    u8 var_v1;
    s32 v;
    u32 var_v0;

    temp_a0 = arg0 & 0xFFFF;
    temp_a1 = arg1 & 0xFFFF;

    if (temp_a1 == 0x1000) {
        var_a3 = 0;
    } else if (temp_a1 == 0x4000) {
        var_a3 = 2;
    } else if (temp_a1 == 0x8000) {
        var_a3 = 1;
    } else if (temp_a1 == 0x2000) {
        var_a3 = 3;
    } else {
        return temp_a0;
    }

    if (arg2 >= 2) {
        return temp_a0;
    }

    temp_t1 = var_a3 & 2;
    sp10 = ((u32)temp_a0 % 14) & 0xFFFF;
    sp14 = ((u32)temp_a0 / 14) & 0xFFFF;

    if (var_a3 & 1) {
        var_v1 = *((u8 *) D_80055994[arg2] + sp14);
        var_a3_2 = (s32 (*)(s32, s32, s32)) D_800559C4[arg2];
        var_s0 = &sp10;
    } else {
        var_s0 = &sp14;
        var_v1 = *((u8 *) D_800559BC[arg2] + sp10);
        var_a3_2 = func_800243D0;
    }

    v = *var_s0;
    if (temp_t1 != 0) {
        *var_s0 = v + 1;
    } else {
        *var_s0 = v - 1;
    }

    if (*var_s0 < 0) {
        *var_s0 = var_v1;
    }

    if ((s32) var_v1 < *var_s0) {
        *var_s0 = 0;
    }

    *var_s0 = var_a3_2(sp10, sp14, temp_t1);

    var_v0 = ((u16) sp10 + (sp14 * 0xE)) & 0xFFFF;

    return var_v0;
}
