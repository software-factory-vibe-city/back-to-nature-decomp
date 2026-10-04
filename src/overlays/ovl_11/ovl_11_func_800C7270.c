#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
s32 func_8001589C(SpriteSourceData *src);

s32 ovl_11_func_800C7270(Recon_ovl_11_func_800C7270_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 ret;

    arg0->unk6C = (arg0->unk6C | 0x20000000) & -0x4000001;
    arg0->unk3E = arg0->unk3C;
    arg0->unk3C = arg1;
    func_80015840((ObjectState *)((u8 *)arg0 + 0x260), arg2 & 0xFF);
    ret = func_8001589C((SpriteSourceData *)((u8 *)arg0 + 0x260));
    if (ret != 0) {
        arg0->unk1C = arg3;
        ret = arg0->unk38;
        arg0->unk265 = ret;
    }
    return ret;
}
