#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80022580 ();
void ovl_11_func_800F8A3C (s32 arg0);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 func_80011F5C (s32 arg0);
void func_80011FD8 (s32 arg0);
void func_800136D4 (u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void func_80015840 (ObjectState *obj, s8 arg1);
void func_8001585C (ObjectState *obj, s8 arg1);
void func_80015EE8 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800F8C1C(u32 *arg0, s32 arg1, s32 arg2, s32 arg3) {
    func_80022580(arg0, 1, 0x19, 0x10, 0x69, 0x4A);
    func_80022580(arg0, 1, 0x79, 0x10, 0xAE, 0x4A);
    func_80022580(arg0, 1, 0x19, 0x5A, 0x10E, 0x4A);
    ovl_11_func_800F8A3C(arg1);
    func_80017B3C(arg1, arg2, 0x1D, 0x14);
    func_80017B3C(arg1, arg3, 0x1D, 0x5E);
}
