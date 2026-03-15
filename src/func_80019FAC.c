#include "common.h"

s16 func_80019FAC(s32 arg0) {
    u32 masked;
    s16 result;

    masked = arg0 & 0xFFFF;
    result = (s16) (0xFEF - masked);
    return result;
}
