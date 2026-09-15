#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11UnalignedWord12904;

void ovl_11_func_80112904(s16 arg0) {
    char *base;
    char *base2;
    char *base3;
    char *base4;
    s16 value;

    value = arg0;
    base = (char *)&D_8006C838;
    base2 = base + 0x8000;
    *(u16 *)(base2 + 0x6778) = value;
    if (value == 3) {
        *(u16 *)(base2 + 0x6776) = 0;
    } else if (value == 7) {
        *(u16 *)(base2 + 0x6776) = 1;
    } else if (value == 9) {
        *(u16 *)(base2 + 0x6776) = 2;
    } else if (value == 0xE) {
        *(u16 *)(base2 + 0x6776) = 3;
    } else {
        *(u16 *)(base2 + 0x6776) = 4;
    }
    base3 = (char *)&D_8006C838;
    base4 = base3 + 0x8000;
    *(u16 *)(base4 + 0x676C) = 0;
    *(Ovl11UnalignedWord12904 *)(base4 + 0x6796) = *(Ovl11UnalignedWord12904 *)(base3 + 0x44B8);
}
