#include "common.h"
#include "debughook.h"

void func_800165D8(s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32, s32);

/*
 * Sprite-submission wrapper: masks arg3 to a byte, records its caller's
 * return address into D_8006C84C (CAPTURE_RA debug hook), and forwards
 * all arguments to func_800165D8 with arg7 passed twice and the tail
 * padded with -1. See notes/research/caller-capture-debug-hook.md.
 */
void func_80016054(s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, s16 arg5,
                   s16 arg6, s32 arg7, s32 arg8, u16 arg9) {
    arg3 &= 0xFF;
    CAPTURE_RA(&D_8006C84C);
    func_800165D8(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7,
                  arg7, 0, arg9, -1, -1, -1, -1);
}
