#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800CADBC(Ovl11Func800CADBCArg0 *arg0, s32 arg1) {
    s32 i;
    s32 j;

    for (i = 0; i < arg1; i++) {
        if (arg0[i].unk0 == 0) {
            for (j = i + 1; j < arg1; j++) {
                if (arg0[j].unk0 != 0) {
                    arg0[i].unk0 = arg0[j].unk0;
                    arg0[i].unk2 = arg0[j].unk2;
                    arg0[i].unk4 = arg0[j].unk4;
                    arg0[j].unk0 = 0;
                    arg0[j].unk2 = 0;
                    arg0[j].unk4 = 0;
                    break;
                }
            }
        }
    }
    return 0;
}
