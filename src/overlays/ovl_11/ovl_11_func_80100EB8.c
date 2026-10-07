#include "common.h"

s32 func_8001F250(s32 arg0, s32 arg1);

/* 6-byte record: three s16 fields. Two stride-6 tables live in D_8006C838 at
 * 0x450A (0x40 entries, scanned by the second loop) and 0x5288 (scanned by the
 * first loop). The s16 at 0x51E6 is the first loop's power exponent. */
typedef struct {
    s16 f0;
    s16 f1;
    s16 f2;
} Rec6;

typedef struct {
    char pad_0000[0x450A];
    Rec6 rec_450A[0x40];
    char pad_468A[0xB5C];
    s16 field_51E6;
    char pad_51E8[0xA0];
    Rec6 rec_5288[0x40];
} View;

s32 ovl_11_func_80100EB8(s32 arg0) {
    u16 s2;
    u8 s3;
    s32 i;

    s2 = arg0 & 0xFFFF;
    s3 = 0;

    if (s2 == 0) {
        return 1;
    }

    for (i = 0; i < func_8001F250(2, ((View *)D_8006C838)->field_51E6 + 1); i++) {
        if (((View *)D_8006C838)->rec_5288[i].f0 == s2) {
            s3 = 1;
            break;
        }
    }

    for (i = 0; i < 0x40; i++) {
        if (((View *)D_8006C838)->rec_450A[i].f0 == s2) {
            s3 = (s3 + 1) & 0xFF;
            break;
        }
    }

    return s3 != 0;
}
