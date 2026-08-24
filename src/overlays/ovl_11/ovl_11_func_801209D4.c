#include "common.h"

extern s16 D_8012DB58;

void ovl_11_func_801209D4(void) {
    char *far_base = (char *)&D_8007AFF0;

    if (*(s32 *)(far_base + 0x254A0) == 0x17) {
        char *st = (char *)&D_8012DB58;

        *(s32 *)(st + 8) += *(s32 *)(st + 4);
        *(u16 *)(far_base + 0x253B6) += *(u16 *)(st + 8);
        *(s32 *)(st + 4) -= 4;
    }
}
