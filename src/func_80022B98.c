#include "common.h"

s32 *D_8005E5B0;
s32 D_8005E5B4;
s32 D_8005E5B8;
s32 D_8005E5CC;
s32 D_8005E334;

void func_80017A38(s16 arg0, s16 arg1);
u32 func_80017A64(void);
void func_80017A48(u32 arg0);
s32 func_80017BC8(s32 *arg0, u16 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5);
void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80022EA4(void);

s32 func_80022B98(void) {
        s32 s1;
    u32 temp_s0;

    func_80017A38(0, 2);
    s1 = 0;
    temp_s0 = func_80017A64();
    func_80017A48(3);
    D_8005E5B4 = func_80017BC8((s32 *)(D_8005E3C0->field_D8 + 8), (u16 *)D_8005E5B0, 0x1E, 0xA8, 0x107, 0x3A);
    func_80017A48(temp_s0);
    func_80017A38(0, 0);
    D_8005E5B8 = 0;
    switch (D_8005E5B4) {
    case 0:
    case 6:
    case 7:
    case 8:
    case 9:
        break;
    case 2:
        ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 5;
        D_8005E5B4 = 0xF;
        break;
    case 1:
    case 3:
    case 4:
    case 5:
        s1 = 1;
        break;
    case 10:
        ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 5;
        D_8005E5B8 = 1;
        D_8005E5B4 = 0xF;
        break;
    case 11:
        ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 5;
        D_8005E5B8 = 2;
        D_8005E5B4 = 0xF;
        break;
    case 12:
        ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 5;
        D_8005E5B8 = 3;
        D_8005E5B4 = 0xF;
        break;
    case 13:
        ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 5;
        D_8005E5B8 = 4;
        D_8005E5B4 = 0xF;
        break;
    }
    if (((struct struct_8006C838_view *)&D_8006C838)->field_CC != 6) {
        func_80022580((u32 *)(D_8005E3C0->field_D8 + 0xC), 0, 0x1A, 0xA4, 0x10B, 0x3E);
        if (s1 != 0) {
            if (D_8005E334 == 1) {
                func_80022EA4();
            }
        }
    }
    if (((struct struct_8006C838_view *)&D_8006C838)->field_CC == 5) {
        D_8005E5CC = 0;
    }
    return 0;
}
