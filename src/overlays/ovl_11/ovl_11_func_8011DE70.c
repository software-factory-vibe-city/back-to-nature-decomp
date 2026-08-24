#include "common.h"

s32 ovl_11_func_8011DE70(s16 arg0) {
    if ((u32) ((arg0 - 1) & 0xFFFF) >= 0x19U) {
        return -1;
    }
    return (arg0 - 1) % 5;
}
