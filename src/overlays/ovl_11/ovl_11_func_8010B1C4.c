#include "common.h"
#include "psyq/stddef.h"

s32 ovl_11_func_8010B778(s32 arg0, s32 arg1);

u16 *ovl_11_func_8010B1C4(s32 arg0) {
    if (((u32) (arg0 - 0x15E) < 2U) && (D_80075AD4 == 0)) {
        ovl_11_func_8010B778((s32) &D_80075AD4, arg0);
        return &D_80075AD4;
    }
    return NULL;
}
