#include "common.h"

void ovl_11_func_80108864(void) {
    char *far_base = (char *)&D_8007AFF0;
    u32 *temp;
    s32 val;

    temp = *(u32 **)(far_base + 0x25388);
    val = *(s32 *)((u8 *)temp + 4);
    if ((u32)(val - 0x58) < 4) {
        D_8012D060.unk0 = 0x15A;
        D_8012D060.unk2 = 0x60;
        D_8012D060.unk4 = 0x140;
        D_8012D060.unk6 = 0x8F;
    } else {
        D_8012D060.unk0 = 0x140;
        D_8012D060.unk2 = 1;
        D_8012D060.unk4 = 0x140;
        D_8012D060.unk6 = -0x30;
    }
}