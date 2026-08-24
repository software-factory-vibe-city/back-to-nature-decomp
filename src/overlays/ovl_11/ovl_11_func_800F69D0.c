#include "common.h"

/* 0x22-byte cell; flag at 0x1E, u16 at 0x20 — see sibling ovl_11_func_800F69FC. */
typedef struct {
    /* 0x00 */ char pad_00[0x1E];
    /* 0x1E */ u8 flag;
    /* 0x1F */ char pad_1F;
    /* 0x20 */ u16 field_20;
} FarmCell;

extern FarmCell D_80129648[];

void ovl_11_func_800F69D0(void) {
    s32 i;

    for (i = 0; i <= 0x47; i++) {
        D_80129648[i].flag = 0;
        D_80129648[i].field_20 = 0;
    }
}
