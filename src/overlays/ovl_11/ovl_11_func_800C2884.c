#include "common.h"

s32 ovl_11_func_800C2884(s16 key, u32 *table) {
    u32 count;
    u32 i;

    count = *table;
    table += 1;
    i = 0;
    if (count != 0) {
        do {
            if (key == *table) {
                return i;
            }
            i += 1;
            table += 1;
        } while (i < count);
    }
    return -1;
}
