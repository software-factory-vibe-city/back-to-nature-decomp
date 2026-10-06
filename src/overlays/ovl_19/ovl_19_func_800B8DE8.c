#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

void ovl_19_func_800B843C(void);
void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_19_func_800BAC50(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2);

void ovl_19_func_800B8DE8(void) {
    s16 *temp_v1;

    ovl_19_func_800B843C();
    D_800BF4E0[0] = 0;
    temp_v1 = &D_800BF4E0[0x24];
    D_800BF4E0[1] = -0x64;
    D_800BF4E0[2] = 0xBE;
    D_800BF4E0[0x24] = 0;
    temp_v1[1] = -0x64;
    temp_v1[2] = -0xBE;
    ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4E0[0x40], 0, 0);
    ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4E0[0x60], 0, 0);
    ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4E0[-8], 1, 1, 0);
    ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4E0[0x1C], 1, 3, 0);
    D_800BF4E0[-0xD] = 1;
}
