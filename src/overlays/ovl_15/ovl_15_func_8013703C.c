#include "common.h"

extern s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
extern void func_8001ABF0(u16 *dst, u16 *src);

void ovl_15_func_8013703C(s16 arg0, s16 *arg1, s32 arg2) {
    s32 offset;

    if (arg0 == 1) {
        offset = 0x12;
    } else if (arg0 == 2) {
        offset = 0x18;
    } else if (arg0 == 3) {
        offset = 0x1E;
    } else {
        offset = 0x24;
    }
    func_8001ABF0((u16 *)func_8001A970(arg0, arg1, arg2),
                  (u16 *)(D_80054BBC[0] + offset + (s32)D_8005175C));
}
