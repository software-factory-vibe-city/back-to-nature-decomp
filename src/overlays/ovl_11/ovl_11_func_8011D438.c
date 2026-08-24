#include "common.h"

s32 ovl_11_func_8011D438(u8 *arg0) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    s32 i;
    u8 *p;

    tmp[0] = phantom;
    p = arg0;
    for (i = 0; i < 10; i++, p++) {
        if (*p == 2) {
            return 1;
        }
    }
    return 0;
}
