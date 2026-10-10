#include "common.h"

extern u8 D_80051DCC[];
extern s8 D_80137584;
extern s8 D_80137587;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s8 ovl_15_func_801370B4(void);

void ovl_15_func_80130048(void) {
    s32 temp_a1;
    s8 temp_v0;

    temp_a1 = D_8005E3C0->field_D8;
    func_8001AC10((void *)(temp_a1 + 0x18), temp_a1 + 0x14, D_80054BBC[0] + (s32)D_80051DCC);
    temp_v0 = ovl_15_func_801370B4();
    switch (temp_v0) {
    case 0:
        D_80137587 = 0;
        D_80137584 = 0x17;
        return;
    case 1:
    case -1:
        D_80137584 = 0;
        return;
    }
}
