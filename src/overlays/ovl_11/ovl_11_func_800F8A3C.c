#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80015840 (ObjectState *obj, u8 arg1);
void func_8001585C (ObjectState *obj, u8 arg1);
void func_80015EE8 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
s32 func_80011F5C (s32 arg0);
void func_80011FD8 (s32 arg0);

extern u16 D_80126E50;
extern s16 D_80126E52;

void ovl_11_func_800F8A3C(s32 arg0) {
    s32 temp_v0_2;
    s32 var_v0;

    func_80015840((ObjectState *) &D_800A0728, 0xD);
    func_8001585C((ObjectState *) &D_800A0728, D_80126E50);
    func_80015EE8(arg0, (s32) &D_800A0728, (s32) (*(u8 *) ((u8 *) &D_800A0728 + 4)), (s32) (*(u8 *) ((u8 *) &D_800A0728 + 5)), 0x7D, 0x90);
    func_80015840((ObjectState *) &D_800A0728, 0xC);
    func_8001585C((ObjectState *) &D_800A0728, D_80126E50);
    func_80015EE8(arg0, (s32) &D_800A0728, (s32) (*(u8 *) ((u8 *) &D_800A0728 + 4)), (s32) (*(u8 *) ((u8 *) &D_800A0728 + 5)), 0x115, 0x90);
    D_80126E52++;
    if (D_80126E52 >= 9) {
        D_80126E52 = 0;
        temp_v0_2 = (s16) D_80126E50 + 1;
        var_v0 = temp_v0_2 / 4;
        D_80126E50 = D_80126E50 - (var_v0 * 4 - 1);
    }
}
