#include "common.h"

/* Lexicographic compare of two 0xFFFF-terminated u16 strings. Returns -1, 0
 * or 1. Companion to func_80017E34 (append) and func_80017EA0 (copy); none of
 * the three is reachable from the shipped code, so this is library code the
 * linker pulled in wholesale.
 *
 * The function spans 0x80017EE4..0x80017F30. It previously appeared in the
 * symbol map as three functions, because its entry is a `j` over the loop's
 * rotated tail rather than a prologue — see notes/tech-debt.md.
 *
 * Source shape is dictated by the loop rotation in GCC 2.95's
 * expand_end_loop (gcc/stmt.c): when a loop's last exit-jump is followed by
 * more body, that trailing body is moved above the loop head and the entry
 * jumps over it. Here the trailing body is `s2++`, which is why it lands at
 * 0x80017EEC ahead of the comparison block and the entry `j` skips it. Moving
 * `s2++` before the terminator test, or ending the loop with a return instead
 * of a break, defeats the rotation and emits an unconditional back-edge
 * instead of the target's conditional one. */
s32 func_80017EE4(u16 *s1, u16 *s2) {
    for (;;) {
        if (*s1 < *s2) {
            return -1;
        }
        if (*s2 < *s1) {
            return 1;
        }
        s1++;
        if (*s2 == 0xFFFF) {
            break;
        }
        s2++;
    }
    return 0;
}
