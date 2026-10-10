#include "common.h"

typedef struct {
    char pad_0000[0x5246];
    s16 field_5246;
    s16 field_5248;
    char pad_524A[0x5492 - 0x524A];
    s16 field_5492;
} D8006C838ViewEF8BC;

s32 ovl_11_func_800EF8BC(s16 arg0, s16 arg1, s16 arg2) {
    char *base;
    char *base0;
    char *base1;
    char *q;
    char *t;
    s16 idx;

    idx = ((D8006C838ViewEF8BC *)D_8006C838)->field_5492;
    if ((arg1 == 3) && (arg2 == 0xD)) {
        goto fail;
    }
    switch (arg0) {
    case -1:
        if ((arg1 == 0) && (arg2 == 0x1D)) {
            goto fail;
        }
        if ((((D8006C838ViewEF8BC *)D_8006C838)->field_5246 == arg1) &&
            (((D8006C838ViewEF8BC *)D_8006C838)->field_5248 == arg2)) {
            goto fail;
        }
        base = (char *)&D_8006C838;
        q = base + idx * 0x1D4;
        if ((*(s16 *)(q + 0x8000 + 0x1A0C) == arg1) &&
            (*(s16 *)(q + 0x8000 + 0x1A0E) == arg2)) {
            goto fail;
        }
        goto one;
fail:
        return 0;
    case 0:
        base0 = (char *)&D_8006C838;
        t = base0 + 0x8000;
        if (t[0x664E] == 0xFF) {
            goto one;
        }
        goto fail;
    case 1:
        base1 = (char *)&D_8006C838;
        if ((arg1 == *(s16 *)(base1 + 0x8000 + 0x26D8)) &&
            (*(s16 *)(base1 + 0x8000 + 0x26DA) != 0)) {
            goto fail;
        }
        if ((arg1 == 2) && (arg2 == 4)) {
            return 0;
        }
        goto one;
    default:
        goto one;
    }
one:
    return 1;
}
