#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void ovl_11_func_800FC544(s32 arg0, s16 arg1, s32 arg2, s32 arg3, s16 arg4);

void ovl_11_func_800FC6A4(void) {
    Ovl11D80127220Entry *var_s1;
    u32 var_s2;

    var_s2 = 0;
    var_s1 = D_80127220;
    for (; var_s2 < 5; var_s2++) {
        *((u16 *)func_8001A970((s32) var_s1->unk2, &D_8012A028, 2)) = 0xFFFF;
        ovl_11_func_800FC544((s32) var_s1->unk0, (s16) var_s1->unk1, (s32) &D_8012A028, 0x8C, (s16) (((var_s2 + 1) * 0x18) + 0x30));
        var_s1++;
    }
}
