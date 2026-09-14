#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800C9E90(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    func_80015840(((ObjectState *)(((s32)(&D_800A0728)))), 0x18);
    ((Recon_ovl_11_func_800C9E90_D_800A0728View *)(&D_800A0728))->unk5 = 0;
    func_80015EE8(arg0, ((s32)(&D_800A0728)), 0x18, arg3 & 0xFF, ((s16)arg1), ((s16)arg2));
}
