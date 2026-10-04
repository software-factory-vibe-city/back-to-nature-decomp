#include "common.h"

extern u8 D_80053350[];
extern s8 D_80137584;
extern s16 D_8013758E;
extern u8 D_80140EC0[];

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
void ovl_15_func_80137544(s32 arg0, s32 arg1);

void ovl_15_func_80131BCC(void) {
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_80053350);
    ovl_15_func_80137544((s32)D_80140EC0, D_8013758E);
    D_80137584 = 12;
}
