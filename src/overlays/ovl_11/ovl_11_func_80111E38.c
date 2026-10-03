#include "common.h"

void ovl_11_func_80111EF0(void);

typedef struct {
    char pad_000[0x44D8];
    s16 field_44D8;
    s16 field_44DA;
    char pad_44DC[0x51C6 - 0x44DC];
    s16 field_51C6;
} Ov11_11E38View;

s32 *ovl_11_func_80111E38(void) {
    ovl_11_func_80111EF0();
    ((Ov11_11E38View *)&D_8006C838)->field_44DA = 0;
    ((Ov11_11E38View *)&D_8006C838)->field_51C6 = 0;
    ((Ov11_11E38View *)&D_8006C838)->field_44D8 = 0;
    return (s32 *)&D_8006C838;
}
