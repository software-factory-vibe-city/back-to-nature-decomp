#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);

typedef struct {
    /* 0x00 */ char pad_00[0x4];
    /* 0x04 */ u16 unk04;
} UnkStruct80112C98;

void ovl_11_func_80112AB4(UnkStruct80112C98 *arg0) {
    s32 value;
    unsigned char *base;

    if (func_8001AF44(0x4F) != 1) {
        value = (s32)&D_8006C838;
        base = (unsigned char *)(value + 0x8000);
        if (*(s16 *)(base + 0x6774) < 0x1E) {
            *(u16 *)(base + 0x6774) += 1;
            return;
        }
        if (func_8001AF44(0x4E) == 1) {
            *(u16 *)(base + 0x6770) += 1;
            return;
        }
        if (arg0->unk04 > 0xFDE7U) {
            func_8001AF70(0x4E, 1);
        }
    }
}
