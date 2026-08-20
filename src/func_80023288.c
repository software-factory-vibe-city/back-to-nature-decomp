#include "common.h"
#include "globals_override.h"

void func_800233B4(void);
void func_80023910(void);
void func_8002348C(void);
void func_80023600(void);

s16 D_8005E33A;
u16 D_8005E338;

void func_80023288(void) {
    s32 temp_s0;
    s16 q;

    temp_s0 = D_8005E3C0->field_D8 + 0x60;
    func_800233B4();
    if (D_8005E338 == 3) {
        func_80023910();
        return;
    }
    SetVal8005E334(0);
    SetVal8005E2BC(0);
    func_8002261C(3, 0x3A9);
    if (D_8005E338 == 1) {
        s16 v = D_8005E33A;
        func_800248B0(temp_s0, (s16) ((v << 6) + 0x24), 0x42);
    } else if (D_8005E338 == 2) {
        q = (s16) (D_8005E33A / 7);
        func_800248B0(temp_s0, (s16) (((D_8005E33A - q * 7) * 0x27) + 0x24), (s16) (q * 0xE + 0x5E));
    }
    func_8002348C();
    func_80023600();
}
