#include "common.h"

extern u16 D_8005E444;

void func_80017AE8(void) {
    if ((D_8005E446 == 1) || (D_8005E446 == 3)) {
        D_8005E446 = 0;
        D_8005E444 += 1;
    }
}
