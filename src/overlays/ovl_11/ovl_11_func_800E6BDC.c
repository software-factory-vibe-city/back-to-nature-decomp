#include "common.h"

s32 ovl_11_func_800E6BDC(s16 arg0) {
    char *far_base;
    char *far_base2;
    s16 var_s0;

    if (arg0 == 0) {
        far_base = (char *)&D_8007AFF0;
        if ((*(u16 *)(*(s32 *)(far_base + 0x25388) + 8) & 0x1000) == 0 ||
            *(s32 *)(far_base + 0x2549C) == 5 ||
            *(s32 *)(far_base + 0x2549C) == 6 ||
            *(s32 *)(far_base + 0x2549C) == 7 ||
            *(s32 *)(far_base + 0x2549C) == 8 ||
            *(s32 *)(far_base + 0x2549C) == 9 ||
            (var_s0 = 0x3F, *(s32 *)(far_base + 0x2549C) == 0xE)) {
            var_s0 = 0x7F;
        }
    } else {
        far_base = (char *)&D_8007AFF0;
        var_s0 = arg0;
    }
    func_80020818();
    far_base2 = (char *)&D_8007AFF0;
    func_8001FB30(0, 0, *(s16 *)(far_base2 + 0x2549C), var_s0);
    return 1;
}
