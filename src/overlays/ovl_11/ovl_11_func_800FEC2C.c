#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Ovl11Packed12;

extern s32 D_801273B0;
extern Ovl11Packed12 D_8012CEE8;

void ovl_11_func_800FEBF8(void);
void func_8001FABC(s16 arg0);

void ovl_11_func_800FEC2C(void) {
    u8 *dst;
    s32 *base;
    u8 *src;

    if (D_801273B0 == 0) {
        ovl_11_func_800FEBF8();
        D_801273B0 = 1;
        dst = (u8 *)&D_8012CEE8;
        base = (s32 *)&D_8006C838;
        src = (u8 *)(base + (0x8000 >> 2));
        *(Ovl11Packed12 *)dst = *(Ovl11Packed12 *)(src + 0x64CC);
        func_8001FABC(3);
    }
}
