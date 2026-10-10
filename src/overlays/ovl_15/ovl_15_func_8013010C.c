#include "common.h"

extern u8 D_800534DC[];
extern s8 D_80137584;
extern s16 D_8013759A;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228(s32 arg0, s32 arg1);
void ovl_15_func_8012E15C(void);

void ovl_15_func_8013010C(void) {
    s8 *p;

    p = &D_80137584;
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_800534DC);
    *p = ovl_15_func_80137228(0x18, 0);
    if (D_8013759A >= 0x5B) {
        *p = 0;
    }
    if (*p != 0x18) {
        ovl_15_func_8012E15C();
        D_80137586 = 1;
    }
}
