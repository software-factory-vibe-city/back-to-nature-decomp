#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);
void func_80015840(ObjectState *obj, u8 arg1);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);

void ovl_27_func_800B998C(void) {
    s32 var;
    s16 q;
    s16 r;

    var = (u16)D_800C4A2C + 1;
    q = (s16)var / 1800;
    D_800C4A2C = var - q * 1800;
    func_80015BF0(D_8005E3C0->field_D8 + 0x8C, (SpriteSourceData *)D_800C4A80, 0x11A, 0xAD);
    if (D_800C4A2C >= 0x5A) {
        D_800C4A2C = 0;
        r = func_80012A34(0xA);
        if (r == (r / 2) * 2) {
            r -= 1;
        }
        if (r < 0) {
            r = 0;
        }
        func_80015840((ObjectState *)D_800C4A80, r);
    }
}
