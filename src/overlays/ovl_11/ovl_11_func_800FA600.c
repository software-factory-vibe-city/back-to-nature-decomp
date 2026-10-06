#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
void func_8001585C(ObjectState *obj, u8 arg1);
void ovl_11_func_800FA950(s16 arg0, s16 arg1, s16 *arg2, s16 *arg3);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FA600(s32 arg0, s32 arg1, s16 arg2, s16 arg3) {
    s16 sp18;
    s16 sp1A;
    Recon_ovl_11_func_800FA600_D80126FD4Entry *temp_s3;

    temp_s3 = &D_80126FD4[arg0];
    func_80015840((ObjectState *) &D_800A0728, temp_s3->unk0);
    func_8001585C((ObjectState *) &D_800A0728, temp_s3->unk1);
    ovl_11_func_800FA950(arg2, arg3, &sp18, &sp1A);
    sp18 = (u16) sp18 + temp_s3->unk2;
    func_80015EE8(arg1, (s32) &D_800A0728, (s32) (*(u8 *) ((u8 *) &D_800A0728 + 4)), (s32) (*(u8 *) ((u8 *) &D_800A0728 + 5)), sp18, sp1A);
}
