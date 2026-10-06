#include "common.h"
#include "game_types.h"

extern s32 (*D_800BA9E4[])(u16 *);
extern s32 D_800BAA34[];

s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2);

s32 ovl_11_func_8010B57C(u16 *arg0, s32 arg1) {
    s32 var_s2;
    s32 (*temp_v0)(u16 *);
    s32 temp_v1;
    s32 var_s3;

    var_s2 = arg1;
    temp_v1 = *(s32 *)((u8 *)arg0 + 0x34);
    var_s3 = 0;
    if (temp_v1 & 0x01000000) {
        var_s2 = 0x11;
    }
    if (temp_v1 & 0x400) {
        return -1;
    }
    temp_v0 = D_800BA9E4[var_s2];
    if (temp_v0 != 0) {
        var_s3 = temp_v0(arg0);
    }
    if ((D_800BAA34[var_s2] != 0) && (var_s3 != -1)) {
        (*(s16 *)((u8 *)arg0 + 0x26)) = var_s2;
        (*(s16 *)((u8 *)arg0 + 0x28)) = 0;
        (*(s16 *)((u8 *)arg0 + 0x2A)) = 0;
        (*(s16 *)((u8 *)arg0 + 0x2C)) = 0;
        ovl_11_func_800D0408(4, (Recon800D0408A1View *)(arg0 + 0x24), 0);
    }
    return var_s3;
}
