#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"
#include "psyq/memory.h"

/* GP-relative globals owned by this TU (CD loading state). */
s32 D_8005E3F0;
s32 D_8005E404;
s32 D_8005E428;
s32 D_8005E430;

s32 func_800145F0(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    u32 start_pos, end_pos;
    s32 byte_count, sectors;
    u_char sp10;
    s32 *p_start, *p_end;

    ResetCallback();
    DrawSync(0);
    p_end = (s32 *)((char *)&D_80048B40 + arg1 * 0x28);
    p_start = (s32 *)((char *)&D_80048B40 + arg0 * 0x28);
    do {
        start_pos = *p_start;
        end_pos = *p_end;
        D_8005E404 = start_pos & 0x7FF;
        D_8005E428 = (start_pos >> 11) + D_8005E430;
        sectors = (end_pos >> 11) - (start_pos >> 11);
        sectors += (end_pos & 0x7FF) != 0;
        byte_count = end_pos - start_pos;
        CdSync(0, 0);
        CdControl(2, CdIntToPos(D_8005E428, (CdlLOC *)&D_8005E3F0), 0);
        sp10 = 0x80;
        do {
            if (CdControl(CdlSetmode, &sp10, 0) == 0) continue;
            break;
        } while (1);
        VSync(3);
        CdRead(sectors, (u_long *)arg3, CdlModeSpeed);
    } while (CdReadSync(0, 0) != 0);
    if (arg2 != arg3 + D_8005E404) {
        memmove(arg2, arg3 + D_8005E404, byte_count);
    }
    return 0;
}
