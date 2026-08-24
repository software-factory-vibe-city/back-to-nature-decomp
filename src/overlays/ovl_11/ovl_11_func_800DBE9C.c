#include "common.h"

typedef struct __attribute__((packed)) {
    s32 a;
    s32 b;
    s32 c;
} Rec12;

typedef struct {
    char pad[0x7AA8];
    s16 field_7AA8;
} View7AA8;

void ovl_11_func_800DBE9C(void) {
    char *base = (char *)&D_8006C838;
    Rec12 *dst = (Rec12 *)(base + 0x7A78);
    s32 i;

    for (i = 0; i < 4; i++) {
        *dst = dst[1];
        dst++;
    }
    ((View7AA8 *)&D_8006C838)->field_7AA8 = -1;
}
