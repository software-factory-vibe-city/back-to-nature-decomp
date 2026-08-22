#include "common.h"

/* Globals accessed GP-relatively (this TU defines them) */
struct_8005E3C0 *D_8005E3C0;

void func_800121D4(void) {
    if (D_8005E3C0->field_D8) {
        ClearOTagR(D_8005E3C0->field_D8, D_8005E3C0->field_EC);
    }
    if (D_8005E3C0->field_DC) {
        ClearOTagR(D_8005E3C0->field_DC, D_8005E3C0->field_F0);
    }
    if (D_8005E3C0->field_E0) {
        ClearOTagR(D_8005E3C0->field_E0, D_8005E3C0->field_F4);
    }
    if (D_8005E3C0->field_E4) {
        ClearOTagR(D_8005E3C0->field_E4, D_8005E3C0->field_F8);
    }
    ClearOTagR(D_8005E3C0->field_120, 0x800);
    D_8005E3C0->field_118 = D_8005E3C0->field_124;
}
