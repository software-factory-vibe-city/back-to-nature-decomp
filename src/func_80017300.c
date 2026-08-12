#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80017300", func_80017300);


/* STATUS 2026-08-11: NOT MATCHED. Best clean-C attempt below (disabled so the
 * ROM check stays green): 320/331 words exact by index, 7 differing words
 * (was 34). Instruction count, opcode multiset and inventory are exact; every
 * register web except three matches.
 *
 * Residual, all measured from the dumps rather than guessed:
 *
 *   1. Branch A and C loop preheaders emit [andi flags2, lui %hi, move] where
 *      the target emits [lui %hi, andi flags2, move]. sched2 shows all three
 *      insns TIE on priority, so the order is a pure LUID tie; the required
 *      LUID order is high < and < move. That order is loop.c's movable
 *      emission order, and the `high` it hoists is a gcse-PRE insertion placed
 *      at the END of the loop-top block (insert_insn_end_bb), hence always
 *      after the andi. Branch B is CORRECT here because its flag test sits in
 *      a single-predecessor block, which lets the assignment live at its use
 *      site (a later block than the gcse insertion) -- see the note.
 *   2. `count_rle = 0` should be the join-block insn reorg duplicates into the
 *      0x800173FC delay slot. Writing it first costs `repeat` 8 units of
 *      REG_LIVE_LENGTH (552 -> 544), which flips allocno_compare for the s7/s8
 *      pair (0.21324 vs branch-A base 0.21053) and rotates 12 more words.
 *      Measured trade (7 words vs 18-19), confirmed over a full 2x2x2 sweep.
 *   3. Branch A materialises the constant 1 in $v1 where the target uses $v0,
 *      and the arg5 reload register is swapped between branches A and B.
 *      Both are local-alloc ties downstream of 1.
 *
 * Levers that DID resolve (keep all of these):
 *   - `flags2 = entry_data & 2` must be hoisted into the loop preheader. At the
 *     top of the row-loop body it always hoists; at its use site it hoists only
 *     where the flag-test block has one predecessor (branch B), and there it
 *     produces the TARGET's preheader order.
 *   - Splitting `header` from `entry_data` (flags) keeps the 0xFFFFFF constant
 *     live in $v0 across the rect.h load, forcing that load into $v1. This
 *     fixed the entire loop-head cluster.
 *   - Declaration order is NOT inert: it sets pseudo numbers, which set the
 *     gcse expression-hash bucket order for `size + 3` vs `entry_idx + 1`,
 *     which decides which owns caller-save slot 0x2C vs 0x30. `entry_idx` must
 *     be declared at least 3 slots after `size`. Worth 8 words.
 *   - A fresh `bytes` local for the rounded byte count restores the target's
 *     single-$v0 tail chain.
 *
 * Ruled out with evidence: per-file flag overrides (flagProbe: baseline 314
 * dominates every column, next best 253); -fmove-all-movables (347 insns);
 * scheduling barriers (worse); a single pre-dispatch flag computation (target
 * has 3 andi, so the flag is computed per branch); exhaustive residual search
 * (domain 2.1e15).
 *
 * Full analysis: notes/human-needed-approvals/func_80017300.md
 */

#if 0
/* Best non-matching attempt: 320/331, 7 differing words. */
#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_80017300(u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5) {
    RECT rect;
    u16 count;
    u32 entry_data;
    u32 header;
    u32 size;
    u32 bytes;
    u8 *src;
    u8 *dst;
    u32 entry_idx;
    s8 count_rle;
    u8 repeat;
    u8 repeat_val = 0;
    s32 row_width;
    u16 height;
    s32 row;
    s32 next_row;
    u16 channel;
    u16 pixel;
    u32 flags2;

    if (*arg0 != 0xD) {
        return;
    }

    count = *(u16 *)(arg0 + 2);
    arg0 += 4;

    for (entry_idx = 0; entry_idx < count; entry_idx = (entry_idx + 1) & 0xFFFF) {
        header = *(u32 *)arg0;
        size = header & 0xFFFFFF;
        entry_data = header >> 24;
        src = arg0 + 12;
        rect.x = *(u16 *)(arg0 + 4);
        rect.y = *(u16 *)(arg0 + 6);
        rect.w = *(u16 *)(arg0 + 8);
        rect.h = *(u16 *)(arg0 + 10);

        if ((entry_data & 3) != 2) {
            rect.x += arg1;
            rect.y += arg2;
        } else if (((s16)rect.w < 0x100) || (arg5 != (entry_data & 3))) {
            rect.x += arg3;
            rect.y += arg4;
        }

        repeat = 0;
        count_rle = 0;
        row_width = (rect.w * 2) & 0xFFFF;
        height = (u16)rect.h;

        if (!(entry_data & 0xC)) {
            rect.h = 1;
            row = 0;
            if (height != 0) {
                do {
                    dst = D_8005EE28;
                    flags2 = entry_data & 2;
                    next_row = row + 1;
                    if (row_width != 0) {
                        row = row_width;
                        do {
                            if (count_rle <= 0) {
                                count_rle = *(s8 *)src++;
                                if (count_rle < 0) {
                                    repeat = 0;
                                    count_rle = (s8)(-count_rle);
                                } else {
                                    repeat = 1;
                                    repeat_val = *src++;
                                }
                            }
                            if (!repeat) {
                                *dst = *src++;
                                dst++;
                            } else {
                                *dst = repeat_val;
                                dst++;
                            }
                            row--;
                            count_rle--;
                        } while (row != 0);
                    }

                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.y++;
                } while (row < height);
            }
        } else if (entry_data & 8) {
            rect.w = 1;
            row = 0;
            if (row_width != 0) {
                do {
                    next_row = row + 2;
                    channel = 0;
                    do {
                        dst = D_8005EE28 + (channel != 0);
                        if (height != 0) {
                            row = height;
                            do {
                                if (count_rle <= 0) {
                                    count_rle = *(s8 *)src++;
                                    if (count_rle < 0) {
                                        repeat = 0;
                                        count_rle = (s8)(-count_rle);
                                    } else {
                                        repeat = 1;
                                        repeat_val = *src++;
                                    }
                                }
                                if (!repeat) {
                                    *dst = *src++;
                                } else {
                                    *dst = repeat_val;
                                }
                                dst += 2;
                                row--;
                                count_rle--;
                            } while (row != 0);
                        }
                        channel++;
                    } while (channel < 2);

                    flags2 = entry_data & 2;
                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.x++;
                } while (row < row_width);
            }
        } else {
            rect.h = 1;
            row = 0;
            if (height != 0) {
                do {
                    dst = D_8005EE28;
                    flags2 = entry_data & 2;
                    next_row = row + 1;
                    if (row_width != 0) {
                        row = row_width;
                        do {
                            *dst = *src++;
                            dst++;
                            row--;
                        } while (row != 0);
                    }

                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.y++;
                } while (row < height);
            }
        }

        do {
        } while (DrawSync(1) != 0);

        bytes = ((size + 3) >> 2) << 2;
        arg0 += bytes + 12;
    }
}
#endif
