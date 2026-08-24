#include "common.h"

extern u8 D_80070D04;

s32 ovl_11_func_80100E68(u16 arg0) {
    if (arg0 < 0x80U) {
        if ((D_80070D04 & arg0) == 0) {
            return 0;
        }
    } else if ((D_80070D04 & 0x80) == 0) {
        return 0;
    }
    return 1;
}
