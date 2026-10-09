#include "common.h"
#include "game_types.h"

extern s16 D_800C4A34;
extern u8 D_800C4B40[];

s32 func_80012A34(s32 arg0);
void func_80015840(ObjectState *obj, u8 arg1);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);

void ovl_27_func_800B9DBC(void) {
    s32 var;
    s16 q;
    s32 arg0;

    var = (u16)D_800C4A34 + 1;
    q = (s16)var / 1800;
    D_800C4A34 = var - q * 1800;
    arg0 = D_8005E3C0->field_D8 + 0x8C;
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B40, 0x3F, 0x95);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B40, 0xA, 0xBC);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B40, 9, 0xD6);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B40, 0x127, 0x34);
    func_80015BF0(arg0, (SpriteSourceData *)D_800C4B40, 0x126, 0x1E);
    if (D_800C4A34 >= 0x14) {
        D_800C4A34 = 0;
        func_80015840((ObjectState *)D_800C4B40, func_80012A34(2) + 0x18);
    }
}
