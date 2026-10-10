#include "common.h"
#include "game_types.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
s32 ovl_11_func_801170D8(s16 *arg0);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_801170E4(s16 arg0, s32 arg1, s16 arg2, s16 arg3);
void func_80024A10(s32 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_11_func_80116F4C(Ovl11Func80116F4CArg *arg0, s32 arg1, s16 arg2, s16 arg3) {
    s16 temp_s0;
    s16 fill;
    s16 *base;
    s16 *var_v1;
    u32 var_a0;

    var_a0 = 0;
    fill = 0xFFD;
    base = &D_8012D608;
    var_v1 = base;
    do {
        *var_v1 = fill;
        var_a0 += 1;
        var_v1 += 1;
    } while (var_a0 < 0x18U);
    if (arg0->unk34 & 0x40) {
        base[0] = 0x90;
    }
    base[4] = 0x71;
    func_8001A970(arg0->unk1E + 1, base + 5, 2);
    base[8] = 0;
    base[9] = 0x26;
    base[10] = 0x24;
    *((u16 *) func_8001A970(ovl_11_func_801170D8(&arg0->unk1A), base + 0xB, 2)) = 0xFFFF;
    func_80017B3C(arg1, (s32) ((u8 *) arg0 + 4), (s32) (s16) (arg2 + 2), (s32) arg3);
    ovl_11_func_801170E4((s16) ((s16) arg0->unk16 / 25), arg1, (s16) (arg2 + 0x48), (s16) (arg3 + 0xC));
    temp_s0 = arg2 + 0x58;
    func_80017B3C(arg1, (s32) base, (s32) temp_s0, (s32) arg3);
    func_80024A10(arg1, (s16) (temp_s0 + 0x10), arg3, arg0->unk1C);
}
