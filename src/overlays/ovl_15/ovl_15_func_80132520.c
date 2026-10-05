#include "common.h"

extern u8 D_80052280[];
extern s8 D_80137584;
extern s16 D_8013759A;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228(s32 arg0, s32 arg1);
void ovl_15_func_80134724(void);

void ovl_15_func_80132520(void) {
    s8 *p;

    p = &D_80137584;
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14,
                  D_80054BBC[0] + (s32)D_80052280);
    *p = ovl_15_func_80137228(0x18, 0x12);
    if (D_8013759A >= 0x5B) {
        *p = 0x12;
    }
    if (*p != 0x18) {
        ovl_15_func_80134724();
    }
}
