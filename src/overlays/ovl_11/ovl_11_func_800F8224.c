#include "common.h"
#include "psyq/memory.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} CopyStruct_8224;

void ovl_11_func_800F8224(s16 *arg0, s16 arg1) {
    s32 i;
    s32 j;
    s32 n;
    CopyStruct_8224 *p;
    CopyStruct_8224 *dst;

    i = 0;
    if (arg1 > 0) {
        do {
            p = (CopyStruct_8224 *)(arg0 + i * 3);
            if (p->field_0 == 0) {
                j = 0;
                dst = p;
                n = arg1 - i;
            loop:
                if (j < n) {
                    p = (CopyStruct_8224 *)(arg0 + (i * 3) + (j * 3));
                    j += 1;
                    if (p->field_0 != 0) {
                        *dst = *p;
                        memset(p, 0, 6);
                    } else {
                        goto loop;
                    }
                }
            }
            i += 1;
        } while (i < arg1);
    }
}
