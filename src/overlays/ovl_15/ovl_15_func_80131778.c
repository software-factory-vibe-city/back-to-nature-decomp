#include "common.h"

extern u8 D_8005306A[];
extern s8 D_80137584;
extern s16 D_8013759A;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228(s32 arg0, s32 arg1);

s32 ovl_15_func_80131778(void) {
    s8 *p;
    s32 ret;

    p = &D_80137584;
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_8005306A);
    ret = ovl_15_func_80137228(5, 0);
    *p = ret;
    if (D_8013759A >= 0x5B) {
        *p = 0;
    }
    return ret;
}
