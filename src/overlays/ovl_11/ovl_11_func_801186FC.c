#include "common.h"

s32 ovl_11_func_801186FC(void) {
    s32 i;

    i = 0;
    do {
        if (func_8001AF44((i + 0x3A) & 0xFFFF) == 0) {
            return i;
        }
        i++;
    } while (i < 5);
    return -1;
}
