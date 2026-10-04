#include "common.h"

void ovl_11_func_800F6680(void);
void func_8001FABC(s16 arg0);
void func_800226D8(s32 arg0);
void func_80017B18(s32 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);

void ovl_11_func_800F6778(void) {
    ovl_11_func_800F6680();
    ((struct struct_8006C838_view *)&D_8006C838)->field_0C |= 0x20000;
    func_8001FABC(3);
    D_80126E40 = 4;
    func_800226D8(0);
    func_80017B18(0);
    func_8002261C(3, 0x37A);
}
