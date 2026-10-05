#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_21_func_800BAF70(void) {
    u8 *base;

    func_80015840((ObjectState *)&D_800C0AFC, 0);
    base = D_800C0AFC - 0x6B4;
    func_80015EE8(D_8005E3C0->field_D8 + 4, (s32)&D_800C0AFC, base[0x6B8],
                  base[0x6B9], (s16)(HWD0 / 2), (s16)(VWD0 / 2));
}
