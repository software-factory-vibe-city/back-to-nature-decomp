#include "common.h"
#include "psyq/libmcrd.h"

s32 ovl_31_func_800B8348(void) {
    long cmds;
    long result;
    s32 status;

    status = 0;
    MemCardSync(0, &cmds, &result);
    result = MemCardUnformat(0);
    if (result >= -1) {
        if (result <= 0) {
            goto setneg;
        } else if (result == 1) {
            goto setpos;
        }
        goto done;
setneg:
        status = -1;
        goto done;
setpos:
        status = 1;
    }
done:
    return status;
}
