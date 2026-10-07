#include "common.h"

extern u8 D_8005346A[];
extern s8 D_80137584;
extern s16 D_8013758C;
extern s16 D_8013758E;
extern s16 D_8013759A;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80136558(s16 arg0, s16 arg1);

void ovl_15_func_8012F8DC(void) {
    s32 var_v0;

    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_8005346A);
    if (D_8013759A >= 2) {
        var_v0 = ovl_15_func_80136558(D_8013758C, D_8013758E);
        if (var_v0 == 0) {
            D_80137584 = 0x13;
        } else if (var_v0 == 0xB) {
            D_80137584 = 0x11;
        } else if (var_v0 == 4) {
            D_80137584 = 0x15;
        } else {
            D_80137584 = 0x10;
        }
    }
}
