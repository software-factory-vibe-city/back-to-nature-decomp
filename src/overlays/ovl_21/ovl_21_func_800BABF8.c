#include "common.h"

long SquareRoot0(long a);

s16 ovl_21_func_800BABF8(s16 arg0) {
    s32 callRet1;

    if (arg0 == 7 || arg0 == 9 || arg0 == 20) {
        char *base;
        char *p;
        base = (char *)&D_8006C838;
        p = base + arg0 * 0x1D4;
        callRet1 = SquareRoot0(*(u16 *)(p + 0x8000 + 0x19EC));
        return (s16)callRet1;
    }
    {
        char *base;
        char *p;
        base = (char *)&D_8006C838;
        p = base + arg0 * 0x1D4;
        return *(s16 *)(p + 0x8000 + 0x19EA);
    }
}
