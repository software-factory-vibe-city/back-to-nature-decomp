#include "common.h"

u16 D_8005E338;
struct struct_8005E340_target *D_8005E340;

void func_80023030(s32 arg0) {
    func_8002301C();
    D_8005E340 = (struct struct_8005E340_target *)arg0;
    D_8005E338 = 1;
}
