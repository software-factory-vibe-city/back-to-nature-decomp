#include "common.h"
#include "psyq/stddef.h"

/* Forward declarations matching the callees' own definitions. */
void func_80019E80(u_long *ot, s16 x0, s16 y0, s16 cond);
s16 GetPairedTpage(s32 tpage);

void func_8001ADD8(u32 *arg0, u16 arg1, s16 arg2, s16 arg3) {
    func_80019E80(arg0, arg2, arg3, GetPairedTpage(arg1));
}
