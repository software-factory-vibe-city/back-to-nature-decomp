#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_17_func_800BAF50(void) {
    u8 *base;

    func_80015840((ObjectState *)&D_800BDA74, 4);
    base = D_800BDA74 - 0x22C;
    func_80015EE8(D_8005E3C0->field_D8 + 4, (s32)&D_800BDA74, base[0x230],
                  base[0x231], 0, 0);
}
