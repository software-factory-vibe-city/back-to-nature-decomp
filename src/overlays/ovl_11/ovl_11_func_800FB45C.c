#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} SwapStruct_B45C;

void ovl_11_func_800FB45C(SwapStruct_B45C *arg0, SwapStruct_B45C *arg1) {
    SwapStruct_B45C temp;

    temp = *arg0;
    *arg0 = *arg1;
    *arg1 = temp;
}
