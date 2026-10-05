#include "common.h"

extern u8 D_80053350[];
extern s8 D_80137584;
extern s16 D_8013758E;

typedef struct {
    char pad_0[0x34];
    s32 field_34;
    s16 field_38;
    s16 field_3A;
} D_801376E0Entry;

extern D_801376E0Entry D_801376E0[];

void func_8001AC10(void *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80135B68(void);

void ovl_15_func_80130D3C(void) {
    s32 temp_a1;

    temp_a1 = D_8005E3C0->field_D8;
    func_8001AC10((void *)(temp_a1 + 0x18), temp_a1 + 0x14, D_80054BBC[0] + (s32)D_80053350);
    if (ovl_15_func_80135B68() == -1) {
        D_80137584 = 0xE;
    }
    else if (D_801376E0[D_8013758E].field_34 != 0x14) {
        D_80137584 = 0xE;
    }
    else {
        D_80137584 = 0x13;
    }
}
