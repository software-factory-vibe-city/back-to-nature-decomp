#include "common.h"

/* GP-relative globals this TU defines (target accesses both via %gp_rel). */
s16 D_8005E31C;
s32 D_8005E530;

/* func_800200E4 is declared with 2 args in functions.h, but the target call
 * passes four ($a0 = &D_80061F28, $a1 = D_8005E530, $a2 = 0, $a3 = 0), so a
 * local 4-arg prototype keeps the argument setup present. */
void SsUtAllKeyOff(short key);
void func_8001FF70(void);
s32 func_800200E4(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 func_80020148(s32 arg0);
s32 func_80020174(s32 arg0, s32 arg1);

void func_8001FBF0(s16 arg0) {
    s32 var_s0;

    D_80061F1C = 0;
    if (arg0 != 0x3E7) {
        if (arg0 < 0x3E8) {
            var_s0 = arg0 * 2;
            if (arg0 == 0) {
                goto sound;
            }
            goto table;
        } else {
            var_s0 = arg0 * 2;
            if (arg0 == 0x3E8) {
                goto f1;
            }
            goto table;
        }
    } else {
        goto f2;
    }
    return;
sound:
    if (D_8005E31C == 0) {
        SsUtAllKeyOff(0);
        func_8001FF70();
        func_800200E4(&D_80061F28, D_8005E530, 0, 0);
        func_80020148(0);
        D_8005E31C = 0;
    }
    return;
f2:
    func_80020148(2);
    return;
f1:
    func_80020148(1);
    return;
table:
    var_s0 = var_s0 + (s32) &D_80049296;
    func_80020148(((u8 *)var_s0)[0]);
    func_80020174(((u8 *)var_s0)[1], 2);
}
