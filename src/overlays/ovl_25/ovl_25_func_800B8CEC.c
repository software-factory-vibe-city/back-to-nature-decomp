#include "common.h"

extern s16 D_800BFE44;

void ovl_25_func_800B8CEC(void) {
    char *far_base = (char *)&D_8007AFF0;
    char *ref;
    s16 value;

    value = *(s16 *)(far_base + 0x253B4);
    ref = (char *)&D_800BFE44;
    if (value < *(s16 *)(ref + 0x20)) {
        *(u16 *)(far_base + 0x253B4) = *(u16 *)(far_base + 0x253B4) +
            ((*(s16 *)(ref + 0x20) - value) * 9) / 10;
    }
    if (*(s16 *)(far_base + 0x253B4) >= 0xCE5) {
        *(s16 *)(far_base + 0x253B4) = 0xCE4;
    }
    *(s16 *)(far_base + 0x253B6) = 0;
    *(s16 *)(far_base + 0x253B8) = *(u16 *)(ref + 0x24);
}
