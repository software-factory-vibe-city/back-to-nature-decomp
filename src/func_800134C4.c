#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_80013668(void);
void SetVal8005E278(s32 arg0);
void SetVal8005E27C(s32 arg0);

/* This TU defines these globals (GP-relative accesses in target). */
s32 D_8005E3D4;
s32 D_8005E3D8;
s32 D_8005E3DC;
s32 D_8005E3E0;

void func_800134C4(void) {
    s32 s0;
    u8 color;
    POLY_F4 *poly;
    DR_MODE *draw_mode;

    if (D_8005E3D4 <= 0) {
        D_8005E3D4 = 0;
        return;
    }

    s0 = (s32)D_8005E3C0 != (s32)&D_8005E5E8;
    func_80013668();
    SetVal8005E278(0);
    SetVal8005E27C(0);

    if (D_8005E3E0 == 1) {
        D_8005E3E0 = 0;
        return;
    }

    if (D_8005E3DC == 1) {
        color = ~(D_8005E3D8 * D_8005E3D4) & 0xFF;
    } else {
        color = (u8)D_8005E3D8;
    }

    poly = &((POLY_F4 *)&D_8005E980)[s0];
    draw_mode = &((DR_MODE *)&D_8005E9B0)[s0];

    setPolyF4(poly);
    setRGB0(poly, color, color, color);
    setXYWH(poly, 0, 0, 0x280, 0x1E0);
    setSemiTrans(poly, 1);
    setDrawMode(draw_mode, 1, 1, 0x140, 0);

    addPrim(D_8005E3B4, poly);
    addPrim(D_8005E3B4, draw_mode);

    D_8005E3D4--;
    if (D_8005E3D4 < 0) {
        D_8005E3D4 = 0;
    }
}
