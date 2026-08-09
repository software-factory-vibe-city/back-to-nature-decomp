#include "common.h"

/* Append a 0xFFFF-terminated u16 string: find the terminator in arg0, then
 * copy arg1 (including its terminator) starting there. Returns a pointer to
 * where the final 0xFFFF was stored.
 *
 * Library code from a 0xFFFF-terminated u16 string TU, pulled in wholesale by
 * the linker (none of it is reachable from shipped code):
 *   func_80017D9C  wrapper (calls 80011F5C/80018B98/80011FD8)
 *   func_80017E34  THIS function: u16 strcat (append)
 *   func_80017EA0  u16 strcpy (copy): byte-identical copy loop, same allocation
 *   func_80017EE4  u16 strcmp (compare): MATCHED
 *
 * The allocation hinges on `c' being ONE user variable shared by the
 * pre-check re-read and the loop store value. Set in two blocks, it is a
 * global allocno (local-alloc.c requires REG_BASIC_BLOCK >= 0 && one death);
 * its block-4 live range overlaps the 0xFFFF constant's $v0 window at the
 * beq, so global-alloc gives it $v1 in BOTH blocks (matching the target's
 * lhu $v1 / sh $v1 in both the pre-check and the loop). The loop compare
 * re-read (*arg1++ != term) then stays the only block-5 local and takes
 * $v0. Writing the store value as a fresh expression temp instead
 * (*++arg0 = *arg1) makes both loop pseudos block-5 locals with exactly
 * equal QTY_CMP_PRI (refs 4, window 4 each); the tie breaks by birth order
 * and the load wrongly takes $v0. The scan loop's term and c share $v1
 * legally: disjoint lifetimes (blocks 0-3 vs 4-5), no allocno conflict. */
u16 *func_80017E34(u16 *arg0, u16 *arg1) {
    u16 term;
    u16 c;

    while (*arg0 != 0xFFFF) {
        arg0++;
    }
    *arg0 = *arg1;
    c = *arg1;
    if (c != 0xFFFF) {
        term = 0xFFFF;
        arg1++;
        do {
            c = *arg1;
            *++arg0 = c;
        } while (*arg1++ != term);
    }
    return arg0;
}
