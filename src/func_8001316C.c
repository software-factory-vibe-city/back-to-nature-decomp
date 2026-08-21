#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_8001316C(u32 arg0, u32 arg1, u32 arg2) {
    POLY_F4 *poly;
    DR_MODE *dr;

    poly = (POLY_F4 *)&D_8005E930[D_8005E3A4];
    dr = (DR_MODE *)&D_8005E960[D_8005E3A4];

    setPolyF4(poly);
    setRGB0(poly, arg0 >> 12, arg1 >> 12, arg2 >> 12);
    setXYWH(poly, 0, 0, 0x140, 0xF0);
    setSemiTrans(poly, 1);
    setDrawMode(dr, 1, 1, 0x40, 0);
    addPrim((s32 *)D_8005E3C0->field_DC, poly);
    addPrim((s32 *)D_8005E3C0->field_DC, dr);
}
