#include "common.h"
#include "psyq/stddef.h"

s32 ovl_11_func_8010946C(s32 arg0, s32 arg1);

struct_800759E4 *ovl_11_func_80108CD0(s32 arg0, s32 arg1) {
    struct_800759E4 *var_v0;

    var_v0 = NULL;
    if ((u32) (arg0 - 0x106) >= 2U) {
        return NULL;
    }
    if (arg1 == 1) {
        var_v0 = &D_800759E4;
        if (D_800759E4.f00 != 0) {
            return NULL;
        }
        ovl_11_func_8010946C((s32) var_v0, arg0);
    }
    return var_v0;
}
