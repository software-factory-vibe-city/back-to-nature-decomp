/* Return 1 if any packed GTE SXY argument has X in [-19, 319]. */
/*
 * POLICY EXCEPTION (owner-authorized): hard-register pinning plus a
 * zero-instruction asm tie. Allowlisted in .pi/autodecomp.json as
 * "register-asm". Everything outside the entry block is ordinary C.
 *
 * Why it is needed. The target's entry block is
 *
 *     sll v1,a0,0x10 ; sra v0,v1,0x10
 *
 * and plain C cannot reach it here, for two coupled reasons in block 0:
 *
 * 1. sxy0's parameter pseudo is referenced only in the entry block, so
 *    combine folds (set (reg 81) (reg $a0)) into the sign-extension. The
 *    shift then reads hard $a0, and local-alloc's combine_regs takes its
 *    hard-register branch and records qty_phys_sugg = {$a0}; find_free_reg
 *    is then called with just_try_suggested and the candidate list is
 *    literally [$a0]. Result: sll a0,a0,0x10.
 * 2. Even with that suggestion removed, block 0 yields $v0, not $v1.
 *    sched1 hoists the sign-extension above the three parameter copies for
 *    sxy1/sxy2/sxy3, which separates the shift temp's quantity from the
 *    addiu/andi/sltiu quantity and leaves $v0 free. Blocks 2 and 4 have no
 *    parameter copies, the two quantities overlap, $v0 is excluded, and the
 *    temp gets $v1 on its own -- which is why they already matched.
 *
 * Both conditions dissolve if the sign-extension is not in the entry block,
 * which is exactly how the adjacent HasTriangleVertexXInBounds matches in
 * clean C: there the identical sll v1,a0,0x10 is emitted from basic block 4,
 * sxy0's pseudo is live across blocks so it becomes a global allocno holding
 * $a0, and dbr only later drops the shift into the entry block's delay slot.
 * This function has no such preceding block: all four arguments are read
 * exactly once across its 28 words, so there is no room for the second
 * reference that would make sxy0's pseudo global.
 *
 * The construct below pins the entry-block shift temp to $v1, bypassing
 * find_free_reg for that quantity; the empty asm tie is required because
 * without it combine folds the pinned temp away and the pin has no effect.
 * The remaining three checks are left to the allocator and match unaided.
 */
#include "common.h"

#define X_MIN -19
#define X_MAX 320

s32 func_8001D2D8(s32 sxy0, s32 sxy1, s32 sxy2, s32 sxy3) {
    register s32 t __asm__("$3");
    s16 x;

    t = sxy0 << 16;
    __asm__ __volatile__("" : "=r"(t) : "0"(t));
    x = t >> 16;
    if (x >= X_MIN && x < X_MAX) {
        return 1;
    }
    x = sxy1;
    if (x >= X_MIN && x < X_MAX) {
        return 1;
    }
    x = sxy2;
    if (x >= X_MIN && x < X_MAX) {
        return 1;
    }
    x = sxy3;
    return x >= X_MIN && x < X_MAX;
}
