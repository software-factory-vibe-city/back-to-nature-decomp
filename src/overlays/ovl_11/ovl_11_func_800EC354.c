#include "common.h"

typedef struct {
    char pad_000[0x44BA];
    s16 field_44BA;
    s16 field_44BC;
} EC354TimeView;

typedef struct {
    char pad_000[0x5246];
    s16 field_5246;
    s16 field_5248;
} EC354View52;

s32 ovl_11_func_800EC354(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s16 var_a0;

    if (arg1 != 0) {
        arg1 = D_80129560[arg0];
    } else {
        arg1 = arg0;
    }
    if (arg1 == 0x29) {
        arg1 = ((EC354View52 *)D_8006C838)->field_5246;
        var_a0 = ((EC354View52 *)D_8006C838)->field_5248;
    } else if (arg1 >= 0x32) {
        s16 idx = (s16)(arg1 - 0x32);
        char *base = (char *)D_8006C838;
        char *q = base + idx * 0xF8;
        arg1 = *(s16 *)(q + 0x8000 + 0x5EC4);
        var_a0 = *(s16 *)(q + 0x8000 + 0x5EC6);
    } else {
        char *base = (char *)D_8006C838;
        char *q = base + arg1 * 0x1D4;
        arg1 = *(s16 *)(q + 0x8000 + 0x1A0C);
        var_a0 = *(s16 *)(q + 0x8000 + 0x1A0E);
    }
    if (arg2 != -1) {
        D_80129560[arg2] = arg1;
    }
    if (arg3 != -1) {
        D_80129560[arg3] = var_a0;
    }
    if (((EC354TimeView *)D_8006C838)->field_44BA == arg1) {
        if (((EC354TimeView *)D_8006C838)->field_44BC == var_a0) {
            return 1;
        }
    }
    return 0;
}
