#include "common.h"
#include "psyq/types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"

/* Globals accessed GP-relatively (this TU defines them) */
s32 D_8005E3A4;
s32 D_8005E3B0;
s32 *D_8005E3B4;
s32 D_8005E3BC;
struct_8005E3C0 *D_8005E3C0;

void func_800120C8(void) {
    GsSetWorkBase((PACKET *)D_8005E3C0->field_12C);
    __asm__ volatile("" ::: "memory");
    {
        s32 temp = D_8005E3A4 * 0x3000;
        temp += 0x38E50;
        D_8005E3BC = D_8005E3B0 + temp;
    }
    ClearOTagR(D_8005E3B4, 2);

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
