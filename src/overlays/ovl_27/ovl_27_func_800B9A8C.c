#include "common.h"
#include "game_types.h"

extern s16 D_800C4A2E;
extern u8 D_800C4AB0[];

s32 func_80012A34(s32 arg0);
void func_80015840(ObjectState *obj, u8 arg1);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);

void ovl_27_func_800B9A8C(void) {
    s32 var;
    s16 q;
    s16 r;

    var = (u16)D_800C4A2E + 1;
    q = (s16)var / 1800;
    D_800C4A2E = var - q * 1800;
    func_80015BF0(D_8005E3C0->field_D8 + 0x8C, (SpriteSourceData *)D_800C4AB0, 0x21, 0x92);
    if (D_800C4A2E >= 0x3C) {
        D_800C4A2E = 0;
        r = func_80012A34(9) + 10;
        if (r == (r / 2) * 2) {
            r -= 1;
        }
        if (r < 10) {
            r = 10;
        }
        func_80015840((ObjectState *)D_800C4AB0, r);
    }
}
