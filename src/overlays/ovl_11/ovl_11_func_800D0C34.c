#include "common.h"

extern u16 D_80070D08;

typedef struct {
    /* 0x00 */ u16 unk00;
    /* 0x02 */ u8 pad02[0x32];
    /* 0x34 */ u32 unk34;
    /* 0x38 */ u8 pad38[0x80];
} Ovl11ElemB8; /* size 0xB8 */

s32 *ovl_11_func_800D0C34(void) {
    s32 *ptr;
    s32 i;
    s32 limit;

    ptr = 0;
    limit = 10;
    if (D_80070D08 != 0) {
        limit = 20;
    }
    for (i = 0; i < limit; i++) {
        ptr = (s32 *)((u8 *)&D_800749F4 + i * 0xB8);
        if (*(u16 *)ptr == 0 && !(*(s32 *)((char *)ptr + 0x34) & 0x02000000)) {
            break;
        }
    }
    if (i == limit) {
        return 0;
    }
    return ptr;
}
