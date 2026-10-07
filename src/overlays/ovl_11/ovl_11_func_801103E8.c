#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_0[0x22];
    /* 0x22 */ u16 unk22;
    /* 0x24 */ char pad_1[0x38 - 0x24];
    /* 0x38 */ s32 unk38;
    /* 0x3C */ char pad_2[0x40 - 0x3C];
    /* 0x40 */ s32 unk40;
} Ovl11Func801103E8Obj;

s32 ovl_11_func_800D0408(u16 arg0, Recon800D0408A1View *arg1, s32 arg2);
s32 ovl_11_func_800D8320(s16 arg0, s16 arg1, s16 arg2, s16 arg3);
s32 ovl_11_func_800D7EF8(Recon800D0408A1View *arg0, s16 *arg1, s16 *arg2);
s32 ovl_11_func_8011E090(Recon800D0408A1View *arg0, s16 *arg1, s16 *arg2);

void ovl_11_func_801103E8(Ovl11Func801103E8Obj *arg0, s32 arg1) {
    Recon800D0408A1View sp10;
    s16 sp20;
    s16 sp22;
    s16 var_s2;
    s32 (*var_s1)(Recon800D0408A1View *, s16 *, s16 *);

    if (arg1 == 1) {
        var_s2 = 0;
        var_s1 = ovl_11_func_800D7EF8;
    } else {
        var_s2 = 1;
        var_s1 = ovl_11_func_8011E090;
    }
    ovl_11_func_800D0408(arg0->unk22, &sp10, 0x64);
    sp10.unk0 += arg0->unk38;
    sp10.unk8 += arg0->unk40;
    if (var_s1(&sp10, &sp20, &sp22) == 0) {
        ovl_11_func_800D8320(var_s2, sp20, sp22, 0);
    }
}
