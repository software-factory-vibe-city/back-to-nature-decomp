#include "common.h"

extern u8 D_8012D110[];

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);
void ovl_11_func_80113C3C(void);

void ovl_11_func_80113B80(void) {
    u8 *base;
    u8 *b;
    s32 var_s1;

    base = (u8 *) D_8006C838;
    var_s1 = (*(s16 *) (base + 0x52C6)) == 0x42;
    if (func_8001AF44(0x44U) == 1) {
        b = D_8012D110;
        (*(s32 *) (base + 0x52CC)) = 0;
        (*(s32 *) (base + 0x52C8)) = (s32) ((*(s16 *) (b + 8) * 0x190) - 0x708);
        (*(s32 *) (base + 0x52D0)) = (s32) (0x7D0 - ((*(s16 *) (b + 0xA) + 2) * 0x190));
        func_8001AF70(0x44U, 0U);
        var_s1 = 1;
    }
    if (var_s1 != 0) {
        ovl_11_func_80113C3C();
    }
}
