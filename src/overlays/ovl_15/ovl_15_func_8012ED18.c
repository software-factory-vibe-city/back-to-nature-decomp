#include "common.h"

extern u8 D_80052FC4[];
extern s8 D_80137584;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
void ovl_15_func_8012E15C(void);

void ovl_15_func_8012ED18(void) {
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14,
                  D_80054BBC[0] + (s32)D_80052FC4);
    ovl_15_func_8012E15C();
    D_80137584 = 1;
}
