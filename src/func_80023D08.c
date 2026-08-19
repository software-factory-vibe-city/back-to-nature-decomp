#include "common.h"
#include "globals_override.h"

/* TU-owned global: gp-relative access in the target (lh %gp_rel) proves this
 * TU declared D_8005E358 (ADR-0001 §2.4). func_80023100.c / func_80023DBC.c
 * carry the same tentative common definition. */
s16 D_8005E358;

extern s32 D_80053888;
/* Kept as an array so the declaration size exceeds -G8: every access of
 * D_80054BBC in the binary is the split lui·lw form (base register ≠ load
 * destination), which only cc1 can emit for a symbol classified >small data. */
extern s32 D_80054BBC[4];

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void func_80023D08(void) {
    s32 sum;

    func_80022580(D_8005E3C0->field_D8 + 0x68, 1, 0x2D, 0x40, 0xE6, 0x56);
    if (D_8005E358 == 0) {
        sum = *D_80054BBC + (s32)&D_800537B2;
    } else {
        sum = *D_80054BBC + (s32)&D_80053888;
    }
    func_80017A38(1, 2);
    func_80017B3C(D_8005E3C0->field_D8 + 0x64, sum, 0x2F, 0x42);
    func_80017A38(0, 0);
}
