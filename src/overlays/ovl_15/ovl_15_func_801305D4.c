#include "common.h"

extern u8 D_80052FFA[];
extern s8 D_80137584;
extern s8 D_80137588;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228(s32 arg0, s32 arg1);

void ovl_15_func_801305D4(void) {
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_80052FFA);
    D_80137584 = ovl_15_func_80137228(2, 0x11);
    D_80137588 = 1;
}
