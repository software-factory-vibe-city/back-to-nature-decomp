#include "common.h"

extern u16 D_8012D052;

s32 ovl_11_func_80108214(void) {
    return (u32) (D_8012D052 - 0x10) < 2U;
}
