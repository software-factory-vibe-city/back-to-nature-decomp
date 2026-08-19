#include "common.h"

extern s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
extern void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void func_8001AAF4(s16 arg0, s16 arg1, s32 arg2, s16 arg3, s16 arg4) {
    s16 *it;
    s16 *p;
    s32 digits;
    s32 i;

    if (arg1 != -1) {
        if (arg1 >= 10) {
            return;
        }
        digits = arg1;
    } else {
        digits = 9;
    }

    it = (s16 *)&D_8005F0A8;
    *((u16 *)func_8001A970((s32)arg0, it, digits)) = 0xFFFF;

    p = it;
    if (arg1 == -1) {
        i = 0;
        if (digits > 0 && *(u16 *)&D_8005F0A8 == 0xFFD) {
            do {
                i++;
                p++;
            } while (i < digits && (u16)*p == 0xFFD);
        }
    }

    func_80017B3C(arg2, (s32)p, (s32)arg3, (s32)arg4);

}
