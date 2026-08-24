#include "common.h"

s32 ovl_11_func_800F06D8(s32 *arg0, s32 *arg1) {
    s32 temp_a2;
    s32 temp_a3;
    s32 var_v0;
    s32 var_v1;

    temp_a3 = arg0[0] - arg1[0];
    temp_a2 = arg0[2] - arg1[2];
    var_v1 = (temp_a3 < 0) ? -temp_a3 : temp_a3;
    var_v0 = (temp_a2 < 0) ? -temp_a2 : temp_a2;
    if (var_v0 < var_v1) {
        return (temp_a3 > 0) ? 3 : 1;
    }
    return (temp_a2 > 0) ? 2 : 0;
}
