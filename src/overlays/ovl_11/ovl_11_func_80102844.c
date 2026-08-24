#include "common.h"

extern u8 D_80070D42;
extern u8 D_80071AC0;

void *ovl_11_func_80102844(s8 arg0, s8 arg1) {
    if (arg0 == 0) {
        return (arg1 * 6) + &D_80071AC0;
    }
    return ((((arg0 - 1) * 8) + arg1) * 6) + &D_80070D42;
}
