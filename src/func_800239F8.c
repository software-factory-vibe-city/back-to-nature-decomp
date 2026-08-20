#include "common.h"

/* TU-owned globals: gp-relative reads in the target (lw %gp_rel / lhu %gp_rel)
 * prove this TU declared D_8005E35C and D_8005E344. Neighbouring TUs
 * (func_80023100.c / func_80023DBC.c / func_80024030.c) carry the same
 * tentative common definitions (-fcommon merges them at link). */
s32 D_8005E35C;
u16 D_8005E344;
u16 D_8005E356;

extern void func_80023A9C(s32 arg0);
extern void func_80023D08(void);
extern void func_80023DBC(void);
extern void func_80024030(void);

void func_800239F8(void) {
    SetVal8005E334(0);
    SetVal8005E2BC(0);
    func_8002261C(3, 0x3A8);
    func_80023A9C(D_8005E35C);
    if (D_8005E344 == 2) {
        func_80024030();
        return;
    }
    func_80024448(D_8005E356);
    func_80023D08();
    func_80023DBC();
}
