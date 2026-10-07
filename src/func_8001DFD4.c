#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/inline_c.h"

/*
 * The SDK's gte_rtps() expands to the ASPSX command placeholder
 * `.word 0x0000007f`, which this project's assembler does not turn into the
 * RTPS command word. The `rtps` mnemonic defined by include/gte_macros.inc
 * (included through include/macro.inc) assembles to the same bytes the
 * original build emitted, so use it while keeping the surrounding nops.
 */
#undef gte_rtps
#define gte_rtps() __asm__ volatile("nop; nop; rtps")

s32 func_8001DFD4(s32 *arg0, SVECTOR *arg1) {
    long flag;
    SVECTOR sxy;

    gte_ldv0(arg1);
    gte_rtps();
    gte_stflg(&flag);
    if (flag < 0) {
        return 0;
    }
    gte_stsxy2(&sxy);
    if (arg0 != 0) {
        arg0[0] = sxy.vx;
        arg0[1] = sxy.vy;
    }
    gte_stszotz(&flag);
    return flag;
}
