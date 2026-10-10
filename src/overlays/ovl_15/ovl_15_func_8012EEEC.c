#include "common.h"

extern u8 D_80053530[];
extern s8 D_80137584;
extern s8 D_80137588;
extern s16 D_8013758C;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s8 ovl_15_func_80136990(void);

void ovl_15_func_8012EEEC(void) {
    s32 temp_a1;
    s8 temp_v0;

    temp_a1 = D_8005E3C0->field_D8;
    func_8001AC10((void *)(temp_a1 + 0x18), temp_a1 + 0x14, D_80054BBC[0] + (s32)D_80053530);
    temp_v0 = ovl_15_func_80136990();
    if (temp_v0 < 2) {
        if (temp_v0 < 0) {
            if (temp_v0 == -1) {
                D_80137588 = 1;
                D_80137584 = 0x16;
            }
        } else {
            D_8013758C = temp_v0;
            D_80137584 = 4;
        }
    }
}
