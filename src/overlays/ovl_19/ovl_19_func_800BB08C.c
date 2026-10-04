#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
void func_8001585C(ObjectState *obj, u8 arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_19_func_800BB08C(s32 arg0, s32 arg1) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    u8 *base;

    tmp[0] = phantom;
    func_80015840((ObjectState *)&D_800BF660, arg0 & 0xFF);
    func_8001585C((ObjectState *)&D_800BF660, arg1 & 0xFF);
    base = D_800BF660 - 0x1A0;
    func_80015EE8(D_8005E3C0->field_D8 + 0x14, (s32)&D_800BF660, base[0x1A4],
                  base[0x1A5], 0, 0);
}
