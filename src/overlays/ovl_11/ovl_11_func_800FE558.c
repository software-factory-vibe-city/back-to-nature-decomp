#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800FE558(s16 arg0, s16 arg1, s16 arg2) {
    s16 *it;
    s16 *var_a1;
    s32 var_a2;

    it = &D_8012A028;
    *((u16 *)func_8001A970((s32)arg0, it, 0xE)) = 0xFFFF;
    var_a1 = it;
    var_a2 = 0;
    if ((u16)D_8012A028 == 0xFFD) {
        do {
            var_a2++;
            var_a1++;
        } while (var_a2 < 0xE && (u16)*var_a1 == 0xFFD);
    }
    func_80017B3C(D_8005E3C0->field_D8 + 0x54, (s32)var_a1, (s32)arg1, (s32)arg2);
}
