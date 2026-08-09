#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"

s32 func_80014554(s32 arg0, s32 arg1) {
    CdlFILE file;
    s32 sectors;
    s32 result;

    ResetCallback();
    DrawSync(0);
    do {
        result = CdSearchFile(&file, (char *)arg0);
    } while (result == 0);
    sectors = (file.size + 0x7FF) >> 11;
    CdControl(CdlSetloc, (u_char *)&file, 0);
    CdRead(sectors, (u_long *)arg1, CdlModeSpeed);
    while (CdReadSync(1, 0) > 0) {
        VSync(0);
    }
    return 0;
}
