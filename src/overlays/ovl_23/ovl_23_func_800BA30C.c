#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

long SquareRoot0(long a);

s32 ovl_23_func_800BA30C(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s32 callRet1;
    callRet1 = SquareRoot0((arg0 - arg2) * (arg0 - arg2) + (arg1 - arg3) * (arg1 - arg3));
    return ((s16)callRet1);
}
