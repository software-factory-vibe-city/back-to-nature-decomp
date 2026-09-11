#include "common.h"

typedef struct {
    char _00[0x2E];
    u16 count;
} IncrementView;

typedef struct {
    char _00[0x2E];
    s16 count;
    s16 max;
} CompareView;

typedef struct {
    char _00[0x28];
    u16 field_28;
    char _2A[0x2];
    void *ptr;
} BufView;

extern s32 D_80129184;

s32 ovl_11_func_800DD45C(BufView *arg0, BufView *arg1, s32 arg2) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    IncrementView *iv;
    CompareView *cv;

    tmp[0] = phantom;

    iv = arg0->ptr;
    iv->count = iv->count + 1;

    cv = arg0->ptr;
    if (cv->count < cv->max) {
        return 0;
    }

    *(s16 *)((u8 *)arg1->ptr + 0x2E) = 0;
    cv->count = 0;

    arg0->field_28 |= 0x1000;
    arg1->field_28 &= 0xEFFF;
    D_80129184 = arg2;
    return 1;
}