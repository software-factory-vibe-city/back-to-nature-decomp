#include "common.h"

extern u8 D_80051FA8[];
extern u8 D_80053114[];
extern s8 D_80137584;
extern s16 D_8013759C;

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 func_8001FABC(s16 arg0);
s8 ovl_15_func_801370B4(void);

void ovl_15_func_8012F6C0(void) {
    s16 temp_s0;
    s32 temp_a1;
    s32 temp_a1_2;
    s32 temp_v0;

    temp_s0 = D_8013759C;
    switch (temp_s0) {
    case 0:
        temp_a1 = D_8005E3C0->field_D8;
        func_8001AC10((void *)(temp_a1 + 0x18), temp_a1 + 0x14, D_80054BBC[0] + (s32)D_80053114);
        if (*(s32 *)((u8 *)D_8005E3A8 + 8) & 0x40) {
            func_8001FABC(0);
            D_8013759C = 1;
        }
        break;
    case 1:
        temp_a1_2 = D_8005E3C0->field_D8;
        func_8001AC10((void *)(temp_a1_2 + 0x18), temp_a1_2 + 0x14, D_80054BBC[0] + (s32)D_80051FA8);
        temp_v0 = ovl_15_func_801370B4();
        if (temp_v0 != 0) {
            if (temp_v0 <= 0 ? temp_v0 == -1 : temp_v0 == temp_s0) {
                D_80137584 = 0;
            }
        } else {
            D_80137584 = 0xD;
        }
        break;
    }
}
