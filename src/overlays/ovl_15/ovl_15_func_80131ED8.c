#include "common.h"
#include "psyq/memory.h"

extern u8 D_80053350[];
extern s8 D_80137584;
extern u8 *D_801376D0;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
void ovl_15_func_8013468C(void);

void ovl_15_func_80131ED8(void) {
    func_8001AC10((void *)(D_8005E3C0->field_D8 + 0x18), D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)D_80053350);
    if (bcmp(D_801376D0 + 0x225C, (u8 *)D_8006C838, 8) == 0) {
        D_80137584 = 0x11;
    } else {
        ovl_15_func_8013468C();
        D_80137584 = 0x12;
    }
}
