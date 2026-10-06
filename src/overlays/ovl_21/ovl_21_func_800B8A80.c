#include "common.h"
#include "game_types.h"

void ovl_21_func_800BA4C0(void);
s32 func_800226A4(void);
s32 func_8001FABC(s16 arg0);
void func_80022738(void);

void ovl_21_func_800B8A80(void) {
    u8 *base;
    s32 fill;
    s32 i;
    s32 tmp;

    fill = 2;
    for (i = 5; i >= 0; i--) {
        ((UnkStruct800C0448 *)D_800C0448)[i].unk18 = fill;
    }
    ovl_21_func_800BA4C0();
    if (func_800226A4() == 5) {
        base = (u8 *)D_800C0448;
        tmp = *(u16 *)(base + 0x988);
        tmp++;
        *(s16 *)(base + 0x988) = tmp;
        if ((s16)tmp >= 0x3D) {
            func_80022738();
            tmp = func_8001FABC(0x39);
            *(s16 *)(base + 0x984) = tmp;
            *(s16 *)(base + 0x988) = 0;
            D_800C0448[0] = 7;
            *(s16 *)(base + 8) = *(s16 *)(base + 0x64C) * 30;
        }
    }
}
