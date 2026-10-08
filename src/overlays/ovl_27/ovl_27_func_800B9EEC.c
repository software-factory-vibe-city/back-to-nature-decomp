#include "common.h"
#include "game_types.h"

extern s16 D_800C4A36;
extern u8 D_800C4B70[];

s32 func_80012A34(s32 arg0);
void func_80015840(ObjectState *obj, u8 arg1);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);

void ovl_27_func_800B9EEC(void) {
    s32 var;
    s16 q;
    s32 arg0;

    var = (u16)D_800C4A36 + 1;
    q = (s16)var / 1800;
    D_800C4A36 = var - q * 1800;
    arg0 = D_8005E3C0->field_D8 + 0x8C;
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B70, 0x17, 0x1E);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B70, 0x6, 0x6D);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B70, 0x24, 0xDF);
    if (D_800C4A36 >= 0x1E) {
        D_800C4A36 = 0;
        func_80015840((ObjectState *)D_800C4B70, func_80012A34(2) + 0x1A);
    }
}
