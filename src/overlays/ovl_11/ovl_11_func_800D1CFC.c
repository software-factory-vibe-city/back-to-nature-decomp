#include "common.h"
#include "game_types.h"

/* Ranks the movement between the object's two recorded points, (0x38, 0x40)
 * and (0x58, 0x60), as a cell of the 3x3 table D_80123A18. Each axis rank is
 * the nested comparator's 0 (equal), 1 (less) or 2 (greater); the y rank is
 * only taken when |dy| * 3 >= |dx|. A short move -- both distances under the
 * D_80123754 threshold and either one under 50 -- clears flag 0x2000 and
 * returns 0 instead.
 *
 * The comparator at 0x800D1CD0 is a GCC nested function, defined here as in
 * the original translation unit, which emits it immediately before this
 * function. Compiling a nested definition mid-parse leaves cc1's
 * cse_not_expected set for the rest of the parent, and that is what places
 * the table's %lo half after the index arithmetic; a declaration alone does
 * not reproduce it. See notes/research/ovl_11_func_800D1CFC-nested-function-cse-not-expected.md.
 */
s32 ovl_11_func_800D1CFC(Recon_ovl_11_func_800D2594_A0View *arg0, Recon800D0408A1View *arg1) {
    s32 ovl_11_func_800D1CD0(s32 a, s32 b) {
        if (a == b) {
            return 0;
        }
        if (a < b) {
            return 1;
        }
        return 2;
    }
    s32 x0;
    s32 x1;
    s32 y0;
    s32 y1;
    s32 dx;
    s32 dy;
    s32 rank1;
    s32 rank2;
    u16 result;

    y0 = *(s32 *) ((u8 *) arg0 + 0x40);
    y1 = *(s32 *) ((u8 *) arg0 + 0x60);
    x0 = *(s32 *) ((u8 *) arg0 + 0x38);
    x1 = *(s32 *) ((u8 *) arg0 + 0x58);
    dx = __builtin_abs(x1 - x0);
    dy = __builtin_abs(y1 - y0);
    rank1 = ovl_11_func_800D1CD0(x0, x1);
    rank2 = 0;
    if (dy * 3 >= dx) {
        rank2 = ovl_11_func_800D1CD0(y0, y1);
    }
    if (dx < D_80123754 && dy < D_80123754 && (dx < 50 || dy < 50)) {
        result = 0;
        arg0->unk34 &= ~0x2000;
    } else {
        result = D_80123A18[rank1 * 3 + rank2];
    }
    return result;
}
