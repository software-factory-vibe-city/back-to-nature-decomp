#include "common.h"

s16 ovl_11_func_800CB0B0(s16 arg0) {
    if (arg0 >= 1 && arg0 <= 25) {
        return (arg0 - 1) / 5;
    }
    if (arg0 >= 26 && arg0 <= 29) {
        return (s16) (arg0 - 26);
    }
    return 0;
}
