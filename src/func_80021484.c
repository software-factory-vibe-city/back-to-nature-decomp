#include "common.h"
#include "psyq/libspu.h"
#include "psyq/libsnd.h"

s32 func_80021484(s32 arg0) {
    char status[24];

    SpuGetAllKeysStatus(status);

    if (status[arg0] == 0 || status[arg0] == 3) {
        return 0;
    }

    (&D_8006C0C8)[arg0] = 0;
    (&D_8006C128)[arg0] = 0x1000000;
    SsUtKeyOffV(arg0);

    return 0;
}
