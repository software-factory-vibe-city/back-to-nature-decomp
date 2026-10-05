#include "common.h"
#include "game_types.h"

extern u16 D_801231FC[];

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
void func_80015894(SomeStruct *arg0, s32 arg1);
void func_80015840(ObjectState *obj, s8 arg1);
void ovl_11_func_800BD8DC(s16 arg0);

void ovl_11_func_800CCFF8(Recon_ovl_11_func_800CCFF8_A0View *arg0, s32 arg1, u8 arg2, s32 arg3) {
    SpriteSourceData *temp_s1;
    s16 temp_v0;

    temp_v0 = arg0->unk3C - 0x3B;
    if (arg1 != 0) {
        ovl_11_func_800BD8DC(temp_v0);
    }
    temp_s1 = (SpriteSourceData *) ((u8 *) arg0 + 0x260);
    func_80015704(temp_s1, (SpriteDataHeader *) D_8007BFF8);
    func_80015894((SomeStruct *) temp_s1, (s32) &D_8007BFF8[D_801231FC[temp_v0]]);
    func_80015840((ObjectState *) temp_s1, 0);
}
