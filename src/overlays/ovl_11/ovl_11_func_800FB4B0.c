#include "common.h"

extern s32 D_80071A8A;

char *ovl_11_func_800FB4B0(s32 arg0) {
    if (arg0 == 0) {
        return (char *)&D_80071A84;
    }
    if (arg0 == 9) {
        return (char *)&D_80071A8A;
    }
    if (arg0 < 9) {
        return (char *)&D_80071A8A + (arg0 * 6);
    }
    return (char *)&D_80071A84 + (arg0 * 6);
}
