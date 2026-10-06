#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

/* User-authorized matching workarounds: retain the buffer's high fragment
 * across the formatter call, then form its complete pointer and first display
 * argument in the original order. These do not establish original asm source. */
void ovl_11_func_800F8B4C(s32 arg0, s32 arg1) {
    register u32 high asm("$16");
    register s16 *buffer asm("$16");
    register s16 *firstBuffer asm("$5");
    register s32 saved asm("$17");
    register s32 firstDisplay asm("$4");
    s16 *end;
    s32 var_a0;

    saved = arg1;
    asm("lui %0,%%hi(D_80129FD8)" : "=r"(high));
    asm("addiu %0,%1,%%lo(D_80129FD8)"
        : "=r"(firstBuffer) : "r"(high));
    end = func_8001A970(D_80126E4A + 1, firstBuffer, 1);
    asm volatile("addu %1,%3,$0\n\taddiu %0,%2,%%lo(D_80129FD8)"
                 : "=r"(buffer), "=r"(firstDisplay) : "r"(high), "r"(arg0));
    *(u16 *)end = 0xFFFF;
    func_80017B3C(firstDisplay, (s32)buffer, 0x28, 0x6E);
    func_80017B3C(arg0, (s32)((u8 *)D_80051BF0 + D_80054BBC[0]), 0x35, 0x6E);
    var_a0 = saved >> 3;
    if (saved < 0) {
        saved += 7;
        var_a0 = saved >> 3;
    }
    *(u16 *)func_8001A970(var_a0, buffer, 1) = 0xFFFF;
    func_80017B3C(arg0, (s32)buffer, 0x42, 0x6E);
}
