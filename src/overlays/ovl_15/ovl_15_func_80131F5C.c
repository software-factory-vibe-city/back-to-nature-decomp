#include "common.h"

extern u8 D_8005204A[];
extern s8 D_80137584;
extern s16 D_8013759A;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228(s32 arg0, s32 arg1);

s32 ovl_15_func_80131F5C(void) {
    s8 *p;
    s32 ret;
    s32 val;

    p = &D_80137584;
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_8005204A);
    ret = ovl_15_func_80137228(0x11, 9);
    *p = ret;
    if (D_8013759A >= 0x5B) {
        val = 9;
        *p = val;
        return val;
    }
    return ret;
}
