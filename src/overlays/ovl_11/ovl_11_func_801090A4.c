#include "common.h"

typedef struct {
    u16 unk0;
    char pad_02[0x22];
    u16 unk24;
    u16 unk26;
    s16 unk28;
    s16 unk2A;
    s16 unk2C;
    char pad_2E[0x06];
    s32 unk34;
} Ovl11HandlerObj;

s32 ovl_11_func_80109594(Ovl11HandlerObj *arg0);

s32 ovl_11_func_801090A4(Ovl11HandlerObj *arg0) {
    void (*handler)(Ovl11HandlerObj *);

    if (arg0->unk0 == 0) {
        return -1;
    }
    handler = (void (*)(Ovl11HandlerObj *)) D_800BA894[arg0->unk26];
    if (handler != 0) {
        handler(arg0);
    }
    if (!(arg0->unk34 & 0x800) && arg0->unk2C >= 0x12C) {
        ovl_11_func_80109594(arg0);
        arg0->unk2C = 0;
    }
    arg0->unk2C = (u16) arg0->unk2C + 1;
    if ((u32) (arg0->unk24 - 0x12) < 4) {
        arg0->unk34 |= 0x100000;
    } else {
        arg0->unk34 &= 0xFFEFFFFF;
    }
    D_8012D084 = 0;
    return 0;
}
