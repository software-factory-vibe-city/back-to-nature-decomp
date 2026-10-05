#include "common.h"

extern s32 D_801273DC;
extern s8 D_801273E4;
extern s8 D_801273E5;

void ovl_11_func_800FFDCC(void);
void ovl_11_func_800F69D0(void);
extern void ovl_11_func_8010021C(void);
s32 ovl_11_func_800F77A8(s16 arg0);
void func_8001FABC(s16 arg0);
void func_800226D8(s32 arg0);
void func_80017B18(s32 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);

void ovl_11_func_800FFEF0(void) {
    ((struct struct_8006C838_view *)&D_8006C838)->field_0C |= 0x20000;
    ovl_11_func_800FFDCC();
    ovl_11_func_800F69D0();
    D_801273E4 = 1;
    D_801273E5 = 1;
    D_801273DC = (s32)ovl_11_func_8010021C;
    func_8001FABC(3);
    ovl_11_func_800F77A8(-1);
    func_800226D8(0);
    func_80017B18(0);
    func_8002261C(3, 0x3B5);
}
