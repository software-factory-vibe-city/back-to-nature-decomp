#include "common.h"
#include "game_types.h"

extern Ovl23D87CView210 D_800BF87C;

s32 ovl_23_func_800BA368(s32 arg0, s32 arg1);
s32 ovl_23_func_800BA278(s32 arg0);

s32 ovl_23_func_800BA1E0(Ovl23Func800BA1E0Arg *arg0) {
    s16 temp_a3;
    s32 var_a1;
    s32 var_a2;
    s32 var_v0;
    s32 sh_a2;
    s32 sh_v0;
    s32 diff;

    var_a2 = arg0->unk14;
    if (var_a2 < 0) {
        var_a2 += 0xFFF;
    }
    sh_a2 = var_a2 >> 12;
    temp_a3 = arg0->unk0;
    var_v0 = D_800BF87C.unk210[temp_a3].unk0;
    if (var_v0 < 0) {
        var_v0 += 0xFFF;
    }
    sh_v0 = var_v0 >> 12;
    diff = sh_a2 - sh_v0;
    var_a1 = arg0->unk18;
    if (var_a1 < 0) {
        var_a1 += 0xFFF;
    }
    return ovl_23_func_800BA278(ovl_23_func_800BA368(diff,
        (var_a1 >> 12) - *(s16 *)((u8 *)&D_800BBA40 + (temp_a3 * 2))));
}
