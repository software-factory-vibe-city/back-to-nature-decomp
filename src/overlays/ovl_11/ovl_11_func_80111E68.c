#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

typedef struct {
    char pad_000[0x44D8];
    s16 field_44D8;
    s16 field_44DA;
    char pad_44DC[0x51C6 - 0x44DC];
    s16 field_51C6;
} Ov11_11E68View;

void ovl_11_func_80111E68(s16 arg0) {
    s32 mode;

    mode = ((u32)(arg0 - 0x13F) < 3) << 2;
    if ((u32)(arg0 - 0xF7) < 3) {
        mode = 2;
    }
    if ((u32)(arg0 - 1) < 0x19) {
        mode = 2;
    }
    if (mode == 0) {
        ((Ov11_11E68View *)&D_8006C838)->field_44DA = 0;
    }
    ((Ov11_11E68View *)&D_8006C838)->field_51C6 = arg0;
    ((Ov11_11E68View *)&D_8006C838)->field_44DA = mode;
    func_8001AF70(0x37, 1);
}
