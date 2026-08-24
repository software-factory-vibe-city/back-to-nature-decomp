#include "common.h"

typedef struct {
    char pad[0x44FC];
    s32 field_44FC;
} Ov11_2508view;

void ovl_11_func_800F2508(void) {
    s32 i;
    signed char *base;

    base = (signed char *)&D_8006C838;
    for (i = 0; i < 20; i++) {
        base[0x49E6 + 4 * i] = -1;
        base[0x4A36 + 4 * i] = -1;
    }
    ((Ov11_2508view *)&D_8006C838)->field_44FC = 0;
}
