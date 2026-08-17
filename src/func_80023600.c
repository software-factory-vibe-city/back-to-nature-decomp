#include "common.h"
#include "game_types.h"

s16 D_8005E33A;
u16 D_8005E338;

s32 func_800226B0(void);
void func_8001FABC(s16 arg0);

s32 func_800236EC(void);
s32 func_80023710(void);
s32 func_8002374C(void);
s32 func_80023774(void);
s16 func_80023794(s32 a0);
s16 func_800237FC(s32 a0);

/* Audio/graphics callback scheduler: picks a callback triple by mode and
 * dispatches on the current display command word. */
void func_80023600(void) {
    s32 (*var_a3)(void);
    s32 (*var_a2)(void);
    s16 (*var_a1)(s32);
    SomeStruct *gfx;
    s16 prev;
    s16 ret;
    s32 cmd;

    if (func_800226B0() != 0) {
        if (D_8005E338 == 1) {
            var_a3 = func_800236EC;
            var_a2 = func_8002374C;
            var_a1 = func_80023794;
        } else if (D_8005E338 == 2) {
            var_a3 = func_80023710;
            var_a2 = func_80023774;
            var_a1 = func_800237FC;
        } else {
            return;
        }
        cmd = ((SomeStruct *)D_8005E3A8)->field_0x8;
        if (cmd == 0x40) {
            var_a3();
            func_8001FABC(0);
            return;
        }
        if (cmd == 0x20) {
            var_a2();
            func_8001FABC(1);
            return;
        }
        prev = D_8005E33A;
        D_8005E33A = var_a1(prev);
        if (D_8005E33A != prev) {
            func_8001FABC(5);
        }
    }
}
