#include "common.h"

typedef struct {
    char pad[0x44DC];
    s16 field_44DC;
} Ov11_00ACview;

s32 ovl_11_func_800F00AC(void) {
    s32 sum;
    s32 i;
    char *base;
    u16 *p;

    sum = 0;
    base = (char *)&D_8006C838;
    p = (u16 *)(base + 0x498C);
    for (i = 0; i < 25; i++) {
        sum += *p++;
    }
    return sum + ((Ov11_00ACview *)&D_8006C838)->field_44DC;
}
