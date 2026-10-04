#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x8];
    /* 0x08 */ u16 unk8;
} Ovl11Func80106E38Arg;

extern void ovl_11_func_80106E38(Ovl11Func80106E38Arg *arg0);

void ovl_11_func_80106EB0(s32 arg0) {
    u32 i;
    s32 sentinel;
    u8 *p;
    u8 *q;

    i = 0;
    sentinel = 0x63;
    p = (u8 *)arg0 + 0x10;
    q = (u8 *)arg0 + 0x1A;
    do {
        if (*(s16 *)q != sentinel) {
            ovl_11_func_80106E38((Ovl11Func80106E38Arg *)p);
        }
        p += 0x2C;
        i++;
        q += 0x2C;
    } while (i < 0x32U);
}
