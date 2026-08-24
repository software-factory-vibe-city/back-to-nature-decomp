#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
} Ovl11Pair3;

extern Ovl11Pair3 D_80124008[][4];

s32 ovl_11_func_800E2AAC(u16 arg0, u16 arg1, u16 *arg2, u16 *arg3) {
    *arg2 = D_80124008[arg0][arg1].field_0;
    if (arg3 != 0) {
        *arg3 = D_80124008[arg0][arg1].field_2;
    }
    return 0;
}
