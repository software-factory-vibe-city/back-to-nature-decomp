#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11E2968UnalignedWord;

void ovl_11_func_800E2A30(s16 *arg0);
void ovl_11_func_80107DD0(s16 *arg0);

s32 ovl_11_func_800E2968(s16 *arg0, s32 arg1) {
    char *base;

    if (*(u16 *) arg0 != 0) {
        return -1;
    }
    memset(arg0, 0, 0xB4);
    if (arg1 != 0x109) {
        if (arg1 == 0x10A) {
            *(s16 *) ((u8 *) arg0 + 0xB0) = 3;
        }
    } else {
        *(s16 *) ((u8 *) arg0 + 0xB0) = 0xA;
    }
    *(s16 *) arg0 = arg1;
    *(s16 *) ((u8 *) arg0 + 0x16) = 0xA;
    base = (char *) &D_8006C838;
    *(Ovl11E2968UnalignedWord *) ((u8 *) arg0 + 0x1A) =
        *(Ovl11E2968UnalignedWord *) (base + 0x44B8);
    *(s16 *) ((u8 *) arg0 + 0x1A) = 0;
    *(u16 *) ((u8 *) arg0 + 0x4) = 0xFFFF;
    ovl_11_func_800E2A30(arg0);
    ovl_11_func_80107DD0(arg0 + 0x54);
    return 0;
}
