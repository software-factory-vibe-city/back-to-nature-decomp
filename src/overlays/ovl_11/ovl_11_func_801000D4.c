#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u8 data[30];
} ovl_11_50B5C_entry; /* 0x20 bytes */

extern struct {
    /* 0x00 */ u8 pad[4];
    /* 0x04 */ ovl_11_50B5C_entry entries[256];
} D_80050B5C;

s32 ovl_11_func_801000D4(s16 arg0) {
    s32 i;

    for (i = 0; D_80050B5C.entries[i].field_0 != 0xE2; i++) {
        if (D_80050B5C.entries[i].field_0 == arg0) {
            return 1;
        }
    }
    return 0;
}
