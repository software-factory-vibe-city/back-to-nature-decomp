#include "common.h"

void ovl_21_func_800BB250(void) {
    char *far_base = (char *)&D_8007AFF0;

    func_8001B9F8(*(s16 *)(far_base + 0x253AC) + *(s16 *)(far_base + 0x253B4),
                  *(s16 *)(far_base + 0x253AE),
                  *(s16 *)(far_base + 0x253B0) + *(s16 *)(far_base + 0x253B8),
                  0);
    func_8001BA40(*(s16 *)(far_base + 0x253B4),
                  *(s16 *)(far_base + 0x253B6),
                  *(s16 *)(far_base + 0x253B8));
}
