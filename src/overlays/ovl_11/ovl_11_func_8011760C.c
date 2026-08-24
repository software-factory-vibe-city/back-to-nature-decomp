#include "common.h"

extern u8 D_8007AFDA;

s32 ovl_11_func_8011760C(void) {
    s32 i;
    u8 *p;

    i = 0;
    p = &D_8007AFDA;
    while (i < 9) {
        if (*p == 2) {
            return i;
        }
        i++;
        p++;
    }
    return -1;
}
