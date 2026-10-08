#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"

void ovl_25_func_800BAAAC(void) {
    char *far_base;
    MATRIX m0;
    MATRIX m1;
    SVECTOR v;
    VECTOR out;
    long flag;

    m0 = GsIDMATRIX;
    m1 = GsIDMATRIX;
    PushMatrix();
    far_base = (char *)&D_8007AFF0;
    v.vx = 0;
    v.vy = *(u16 *)(far_base + 0x253A0);
    v.vz = 0;
    RotMatrix(&v, &m0);
    SetRotMatrix(&m0);
    SetTransMatrix(&m1);
    v.vx = 0;
    v.vy = 0;
    v.vz = *(u16 *)(far_base + 0x25394);
    RotTrans(&v, &out, &flag);
    PopMatrix();
    *(u16 *)(far_base + 0x253AC) = out.vx;
    *(s16 *)(far_base + 0x253AE) = *(u16 *)(far_base + 0x25398) + *(u16 *)(far_base + 0x253B6);
    *(u16 *)(far_base + 0x253B0) = out.vz;
}
