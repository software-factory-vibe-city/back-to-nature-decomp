#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"

s32 D_8005E3F0;
volatile s32 D_8005E410;
s16 D_8005E414;
s32 D_8005E418;
s32 D_8005E41C;
s32 D_8005E420;
s32 D_8005E428;
s32 D_8005E430;

s32 func_80014988(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s16 idx;
    s32 sector_count;
    s32 sectors;
    s32 one;
    u_char sp18;

    idx = (s16)arg0;
    one = 1;
    sector_count = ((u32)arg2 + 0x7FF) >> 11;
    sectors = sector_count + 1;
    D_8005E428 = (D_80048B1C[idx].loc >> 11) + ((u32)arg1 >> 11) + D_8005E430;

    if (D_8005E410 == 0 || arg4 == one) {
        for (;;) {
            CdReadBreak();
            CdFlush();
            CdSync(0, 0);
            D_8005E414 = idx;
            D_8005E418 = arg1;
            D_8005E41C = arg3;
            D_8005E420 = arg2;
            if (CdControl(CdlSetloc, CdIntToPos(D_8005E428, (CdlLOC *)&D_8005E3F0), 0) != 0) {
                sp18 = 0x80;
                do {
                    if (CdControl(CdlSetmode, &sp18, 0) == 0) continue;
                    break;
                } while (1);
                VSync(3);
                if (CdRead(sectors, (u_long *)arg3, CdlModeSpeed) != 0) break;
            }
        }
        D_8005E410 = 1;
        return 0;
    }

    if (D_8005E410 == 0) goto fail;

    {
        s32 result = CdReadSync(1, 0);
        if (result != -1) {
            if (result != 0) return 0;
            D_8005E410 = 0;
            return 1;
        }
        D_8005E410 = 0;
        return func_80014988(idx, arg1, arg2, arg3, arg4);
    }

fail:
    return -1;
}
