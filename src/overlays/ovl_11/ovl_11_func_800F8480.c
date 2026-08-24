#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} CopyStruct_8480;

void ovl_11_func_800F8480(CopyStruct_8480 *arg0, CopyStruct_8480 *arg1) {
    CopyStruct_8480 temp;

    temp = *arg0;
    *arg0 = *arg1;
    *arg1 = temp;
}
