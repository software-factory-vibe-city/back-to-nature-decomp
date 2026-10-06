#include "common.h"
#include "game_types.h"

s32 func_800199F8(s32, s32, s32, s16, s16, s16, s32, s16);

s32 func_80019AD0(s32 arg0, s32 arg1, u16 *arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7, s16 arg8) {
    TextCopyBlock buf;
    u16 *src;
    u16 *cur;
    u32 found;
    s32 done;

    src = arg2;
    done = 0;
    do {
        buf = *(TextCopyBlock *)src;
        buf.data[40] = 0xFFFF;
        for (found = 0; found < 41; found++) {
            cur = buf.data + found;
            if (*cur == 0xFFFE) {
                *cur = 0xFFFF;
                found++;
                break;
            }
            if (*cur == 0xFFFF) {
                done = 1;
                found++;
                break;
            }
        }
        src += found;
        arg1 = func_800199F8(arg0, arg1, (s32)buf.data, arg3, arg4, arg5, arg6, arg8);
        arg4 += arg7;
    } while (done != 1);
    return arg1;
}
