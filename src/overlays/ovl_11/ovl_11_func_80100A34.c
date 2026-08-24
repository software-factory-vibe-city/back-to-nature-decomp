#include "common.h"

typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ u16 field_4;
    /* 0x06 */ u8 data[26];
} ovl_11_seek_entry; /* 0x20 bytes */

extern ovl_11_seek_entry D_80050B5C[];

s32 ovl_11_func_80100A34(u16 arg0) {
    s32 i;

    for (i = 0; D_80050B5C[i].field_4 != 0xE2; i++) {
        if (D_80050B5C[i].field_4 == arg0) {
            return D_80050B5C[i].field_0;
        }
    }
    return 0x2206;
}
