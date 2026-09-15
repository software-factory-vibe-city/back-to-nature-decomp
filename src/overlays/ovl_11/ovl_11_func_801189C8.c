#include "common.h"

extern s32 D_800BB228;
extern s32 D_800BB248;
extern s32 D_800BB2C0;
extern s32 D_8012D520;
extern s32 D_8012D52C;

s32 ovl_11_func_801189C8(void) {
    s32 (*fn)(void);
    s32 (*fn2)(void);
    s32 *base;
    s32 var_s0;

    var_s0 = 1;
    if (D_8012D520 != 0) {
        fn = (s32 (*)(void)) ((s32 *) &D_800BB248)[D_8012D520];
        if (fn != 0) {
            var_s0 = 0;
            if (fn() != 0) {
                var_s0 = 1;
                fn2 = (s32 (*)(void)) D_800BB2C0;
                fn2();
            }
        }
        base = &D_800BB228;
        fn = (s32 (*)(void)) base[D_8012D52C];
        if (fn != 0) {
            ((void (*)(s32 *)) fn)(base);
        }
    }
    return var_s0;
}
