#include "common.h"
#include "game_types.h"

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header, s32 arg2, s32 arg3);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void func_80024A4C(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4) {
    s16 arg3_16;

    arg3_16 = (s16)arg3;

    if (((SpriteSourceData *)&D_800A0728)->field_14 != (s32)&D_800977F8) {
        ((void (*)(SpriteSourceData *, SpriteDataHeader *))func_80015704)(
            (SpriteSourceData *)&D_800A0728, (SpriteDataHeader *)&D_800977F8);
    }

    func_80015EE8(arg0, (s32)&D_800A0728, arg1 & 0xFF, arg2 & 0xFF, arg3_16, arg4);
}
