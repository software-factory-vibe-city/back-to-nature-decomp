#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"

/* GP-relative globals owned by this TU (CD loading state). */
s32 D_8005E2B0;
s32 D_8005E3F0;
s32 D_8005E3F8;
s32 D_8005E3FC;
s32 D_8005E400;
s32 D_8005E404;
s32 D_8005E408;
s32 D_8005E40C;
s32 D_8005E428;
s32 D_8005E430;

s32 func_80014854(s32 arg0, s32 arg1, s32 arg2) {
    u32 pos_start;
    u32 pos_end;
    s32 sectors;
    s32 amount;

    pos_start = D_80048B1C[arg0].loc;
    pos_end = D_80048B1C[arg1].loc;
    D_8005E408 = arg0;
    D_8005E404 = pos_start & 0x7FF;
    D_8005E428 = (pos_start >> 11) + D_8005E430;
    sectors = (pos_end >> 11) - (pos_start >> 11);
    sectors += (pos_end & 0x7FF) != 0;

    if (D_8005E2B0 != 0) {
        goto busy;
    }

    for (;;) {
        CdSync(0, 0);
        D_8005E3F8 = arg0;
        D_8005E3FC = arg1;
        D_8005E400 = arg2;
        amount = arg2 - D_8005E404;
        if (CdControl(CdlSetloc, CdIntToPos(D_8005E428, (CdlLOC *)&D_8005E3F0), 0) != 0 &&
            CdRead(sectors, (u_long *)amount, CdlModeSpeed) != 0) {
            D_8005E2B0 = 1;
            D_8005E40C = 0;
            break;
        }
    }

    return 0;

busy:
    return 1;
}
