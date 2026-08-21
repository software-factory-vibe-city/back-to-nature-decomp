#include "common.h"

void func_80017300(u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);

void func_80017240(u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4) {
    func_80017300(arg0, arg1, arg2, arg3, (s16) (s32) arg4, 2);
}
