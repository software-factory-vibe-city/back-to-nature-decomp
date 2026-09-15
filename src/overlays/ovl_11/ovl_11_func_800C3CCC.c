#include "common.h"

void ovl_11_func_800C3CCC(void) {
    char *far_base = (char *)&D_8007AFF0;
    char *c838_base;
    struct_80076220 *p;
    s32 *ptr;
    s32 i;
    s32 temp;

    ptr = *(s32 **)(far_base + 0x25388);
    if (*(s16 *)ptr == 0x13) {
        c838_base = (char *)&D_8006C838;
        if (*(s16 *)(c838_base + 0x5238) < 0xF) {
            *(u16 *)(c838_base + 0x5238) = *(u16 *)(c838_base + 0x5238) + 1;
        }
        p = &D_80076220;
        for (i = 0; i < 37; i++) {
            p->unk2 = p->unk2 - 1;
            if ((s16)p->unk2 < 0) {
                p->unk2 = 0;
            }
            temp = p->unk4 - 1;
            if (temp < 0) {
                p->unk4 = 0;
            } else {
                p->unk4 = temp;
            }
            p++;
        }
    }
}
