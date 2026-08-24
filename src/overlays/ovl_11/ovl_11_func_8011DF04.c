#include "common.h"

s32 ovl_11_func_8011DF04(s16 arg0) {
    if (arg0 == 0x7A)
        return 3;
    if (arg0 == 0x7B)
        return 2;
    if (arg0 != 0x7C)
        return (arg0 == 0x60) * 4;
    return 1;
}
