#include "common.h"

extern s32 D_8012D040;

s32 func_8002261C(s32 arg0, s32 arg1);

s32 ovl_11_func_80108828(void) {
    return func_8002261C(3, D_8012D050[D_8012D040].field_0);
}
