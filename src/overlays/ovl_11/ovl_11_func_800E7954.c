#include "common.h"

/* D_8005E5E8 view for this function: the byte fields at +0x19..+0x1B of
 * each 0x134-byte element. */
typedef struct {
    char pad_000[0x19];
    s8 field_19;
    s8 field_1A;
    s8 field_1B;
    char pad_01C[0x134 - 0x1C];
} view_8005E5E8;

/* D_8006C838 view for this function: the s32 flag words at +0x448C and
 * +0x5234. Reached as struct members so cc1 builds the D_8006C838 base
 * address and keeps the symbol high half across the switch. */
typedef struct {
    char pad_000[0x448C];
    s32 field_448C;
    char pad_4490[0x5234 - 0x4490];
    s32 field_5234;
} view_8006C838;

s32 ovl_11_func_800E7954(s16 arg0) {
    ((view_8006C838 *)D_8006C838)->field_448C = 0;
    switch (arg0) {
    case 0: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x12;
        break;
    }
    case 1: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x16;
        ((view_8005E5E8 *)D_8005E5E8)[0].field_19 = 0;
        ((view_8005E5E8 *)D_8005E5E8)[0].field_1A = 0;
        ((view_8005E5E8 *)D_8005E5E8)[0].field_1B = 0;
        ((view_8005E5E8 *)D_8005E5E8)[1].field_19 = 0;
        ((view_8005E5E8 *)D_8005E5E8)[1].field_1A = 0;
        ((view_8005E5E8 *)D_8005E5E8)[1].field_1B = 0;
        break;
    }
    case 2: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x13;
        break;
    }
    case 3: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x14;
        break;
    }
    case 4: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x15;
        break;
    }
    case 5: {
        u8 *far = (u8 *)&D_8007AFF0;

        *(s32 *)(far + 0x254A0) = 0x1F;
        ((view_8006C838 *)D_8006C838)->field_5234 |= 0x400;
        break;
    }
    }
    return 1;
}
