#include "common.h"
#include "psyq/libmcrd.h"

s32 ovl_31_func_800B82E8(void) {
    long cmds;
    long result;
    s32 status;

    status = 0;
    MemCardSync(0, &cmds, &result);
    result = MemCardFormat(0);
    if (result != 0) {
        if (result >= 0) {
            if (result < 3) {
                status = -1;
            }
        }
    } else {
        status = 1;
    }
    return status;
}
