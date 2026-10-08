#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

void func_80019E14 (s32 arg0, s16 arg1, s16 arg2);
void func_80017A38 (s16 arg0, s16 arg1);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_800136D4 (u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);

void ovl_11_func_8011D150(s32 arg0, s32 arg1, s16 arg2, s16 arg3, s16 arg4) {
    s32 var_s4;
    s32 var_s2;
    s32 var_a1;

    if (arg0 != 0) {
        var_s4 = 9;
        var_s2 = *D_80054BC0 + (s32) D_800517EE;
    } else {
        var_s4 = 4;
        var_s2 = *D_80054BC0 + (s32) D_800517E0;
    }
    var_a1 = arg4 * 0xE + 4;
    func_80019E14(arg1, (s16) (arg2 + 4), (s16) (arg3 + var_a1));
    func_80017A38(0, 2);
    func_80017B3C(arg1, (s32) var_s2, (s32) (s16) (arg2 + 0xC), (s32) (s16) (arg3 + 4));
    func_80017A38(0, 0);
    func_800136D4((u32 *) arg1, arg2, arg3, (var_s4 * 8) + 8, 0x24);
}
