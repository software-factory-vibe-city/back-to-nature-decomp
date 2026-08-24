#include "common.h"

/* 0x22-byte entry; the byte at 0x1E of each cell is cleared by this function. */
typedef struct {
    /* 0x00 */ char pad_00[0x1E];
    /* 0x1E */ u8 flag;
    /* 0x1F */ char pad_1F[0x22 - 0x1F];
} FarmCell;

extern FarmCell D_80129648[];

void ovl_11_func_800F69FC(void) {
    s32 i;

    i = 0x47;
    do {
        D_80129648[i].flag = 0;
        i--;
    } while (i >= 0);
}
