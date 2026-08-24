#include "common.h"

s32 ovl_11_func_800E2934(void *arg0) {
    s32 i;
    s8 *p;

    i = 0;
    p = (s8 *)&D_800742EC;
    for (; i < 10; i++, p += 0xB4) {
        if (arg0 == (void *)p) {
            return i;
        }
    }
    return -1;
}
