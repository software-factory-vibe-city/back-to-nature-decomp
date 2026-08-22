#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"

/* GP-relative globals owned by this TU (CD loading state). */
s32 D_8005E3F0;
s32 D_8005E428;
s32 D_8005E430;

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    u_char sp10;
    s32 hi1;
    s32 sector;

    hi1 = (u32)arg1 >> 11;
    sector = (u32)arg2 >> 11;
    for (;;) {
        D_8005E428 = hi1 + D_8005E430;
        CdReadBreak();
        CdFlush();
        CdSync(0, 0);
        CdControl(CdlSetloc, CdIntToPos(D_8005E428, (CdlLOC *)&D_8005E3F0), 0);
        if (arg3 != -1) {
            sp10 = 0x80;
            do {
            } while (CdControl(CdlSetmode, &sp10, 0) == 0);
            VSync(3);
            CdRead(sector, (u_long *)arg4, CdlModeSpeed);
            if (CdReadSync(0, 0) != 0) {
                continue;
            }
        }
        break;
    }
}
