#include "common.h"

/* Game callee (signature from include/functions.h; local declaration per
 * project convention). */
s32 func_8001A284(s32 arg0);

/* arg1 is u16: the target's entry `andi s3,a1,0xffff` is the zero-extension
 * conversion emitted in assign_parms' conversion window, which precedes the
 * s16 arg2 decode and gives the target's prologue order (masked arg1 before
 * the count sll/sra).
 *
 * The table fallback keeps the loaded value in its own web (`value`), tests
 * it, and only then merges it into `nin` on the nonzero path: this is what
 * produces the target's `lw v0,0(v0); beqz v0; addu a0,v0,0` — the load
 * lands in $v0 and the move to $a0 survives instead of coalescing away.
 * `goto skip_rec` is required so the shared recursion statement is written
 * once and reached from both the func-result path and the table-value path,
 * matching the target's single use block. */
s32 func_8001945C(u16 *arg0, u16 arg1, s16 arg2) {
    u16 *ptr;
    s32 index;
    s32 temp;
    s32 masked;
    s32 nin;
    s32 value;

    ptr = arg0;
    index = 0;

    for (;;) {
        if (arg2 != 0 && index >= arg2) {
            break;
        }
        temp = *ptr;
        masked = temp & 0xFFFF;
        if (masked == 0xFFFF || masked == arg1) {
            index++;
            break;
        }
        if (masked != 0xFFFE && (temp & 0x4000)) {
            nin = func_8001A284(*(volatile u16 *)ptr);
            if (nin == 0) {
                value = D_8005F0C8[*ptr & 0xFFF];
                if (value == 0) {
                    goto skip_rec;
                }
                nin = value;
            }
            index += func_8001945C((u16 *)nin, arg1, (s16)((arg2 != 0) ? (arg2 - index) : 0));
        skip_rec:
            ;
        }
        index++;
        ptr++;
    }
    return index & 0xFFFF;
}
