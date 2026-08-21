#include "common.h"
#include "game_types.h"

/* Callback prototype: 5 arguments (4 register + 1 stack at 0x10($sp)). */
typedef void (*SpriteCallback)(s32, SpriteSourceData *, s16, s32, s32);

void func_800223D4(s32 arg0, SpriteCallback callback);
void func_800224F0(s32, SpriteSourceData *, s16, s32, s32); /* extern */

void func_8002238C(s32 arg0) {
    func_800223D4(arg0, func_800224F0);
}
