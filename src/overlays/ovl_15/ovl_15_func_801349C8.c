#include "common.h"

extern char *D_8013765C[];

void ovl_15_func_801349C8(s16 arg0, char *arg1) {
    s16 idx;

    *arg1 = 0;
    if (arg0 >= 0) {
        idx = (arg0 < 4) ? arg0 : 3;
    } else {
        idx = 0;
    }
    strcat(arg1, D_8013765C[idx]);
}
