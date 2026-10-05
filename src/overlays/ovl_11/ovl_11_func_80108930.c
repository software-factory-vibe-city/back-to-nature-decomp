#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80017200 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void func_80017300 (u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5);

extern s32 D_8012D068;
extern s32 D_8012D06C;

void ovl_11_func_80108930(void) {
    s32 temp_a1;
    s32 var_a1;

    var_a1 = D_8012D068;
    if (D_8012D068 < 0) {
        var_a1 = D_8012D068 + 0xF;
    }
    temp_a1 = (var_a1 >> 4) - ((D_8012D068 / 48) * 3);
    if (D_8012D06C != temp_a1) {
        D_8012D06C = temp_a1;
        func_80017200((D_8007BFF8 + (temp_a1 << 0xB)), D_8012D060.unk0, D_8012D060.unk2, D_8012D060.unk4, (s16) (s32) D_8012D060.unk6);
    }
    D_8012D068 += 1;
}
