#include "common.h"
#include "psyq/libmcrd.h"

void ovl_15_func_80137544(char *arg0, s32 arg1);

extern s16 D_80137598;
extern s8 D_80140EC0;

s32 ovl_15_func_80136558(s16 arg0, s16 arg1) {
    s32 sp10;
    s32 sp14;
    s32 var_s2;
    s32 var_v0;

    var_s2 = 0;
    if (arg0 != 0) {
        var_v0 = 0xC;
        if (arg0 == 1) {
            var_s2 = 0x10;
            goto block_3;
        }
        return var_v0;
    }
block_3:
    ovl_15_func_80137544(&D_80140EC0, (s32) arg1);
    D_80137598 = 0;
    MemCardSync(0, &sp10, &sp14);
loop_4:
    sp14 = MemCardCreateFile(var_s2, &D_80140EC0, 4);
    switch (sp14) {
    case 1:
    case 2:
    case 4:
    case 6:
    case 7:
        if (D_80137598 < 7) {
            D_80137598 = (u16) D_80137598 + 1;
            goto loop_4;
        }
        if (sp14 != 1) {
            var_v0 = 7;
            if (sp14 != var_v0) {
                return 2;
            }
            var_v0 = 0xB;
            return var_v0;
        }
        return 4;
    case 0:
        return 0;
    default:
        var_v0 = 2;
        return var_v0;
    }
}
