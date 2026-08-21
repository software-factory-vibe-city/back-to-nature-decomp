#include "common.h"
#include "game_types.h"

void func_800223D4(s32, void (*)(s32, SpriteSourceData *, s16, s32, s32));
void func_80022528(s32, SpriteSourceData *, s16, s32, s32);

void func_800223B0(s32 arg0) {
    func_800223D4(arg0, func_80022528);
}
