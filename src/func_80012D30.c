#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

s32 func_80013394(void);
void SetVal8005E29C(s32 arg0);
void SetVal8005E27C(s32 arg0);
s32 GetFlag8005E274(void);
void func_80012A68(s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, u8 arg5, u8 arg6);

/* TU-owned globals (GP-relative accesses in target). */
s32 D_8005E28C;
s16 D_8005E294;
s32 D_8005E298;
s32 D_8005E29C;
s16 D_8005E2A0;
s32 D_8005E3C8;
s16 D_8005E3CC;
s16 D_8005E3CE;
s32 D_8005E3D0;

void func_80012D30(void) {
    POLY_F4 *s0;
    DR_MODE *s2;
    s32 *ot;
    s32 a2;
    s32 a3;
    s32 s4;
    s32 v1;
    s32 product;

    s4 = 0;
    if (func_80013394() != 1 || D_8005E29C == 1) {
        SetVal8005E29C(1);
        D_8005E3C8 = (u32)D_8005E3C8 < 1;
        if (D_8005E298 == 1) {
            D_8005E298 = 0;
            return;
        }
        if (D_8005E294 == 1) {
            if (D_8005E3CC > 0)
                D_8005E3CC = D_8005E3CC - 1;
        } else if (D_8005E294 == 2) {
            if (D_8005E3CC <= D_8005E3CE + 6)
                D_8005E3CC = D_8005E3CC + 1;
        } else if (D_8005E294 == 3) {
            SetVal8005E27C(0);
            if (D_8005E3CE > D_8005E3CC) {
                if (GetFlag8005E274() == 0)
                    D_8005E3CC = D_8005E3CC + D_8005E3C8;
                else
                    D_8005E3CC = D_8005E3CC + 1;
            }
        } else {
            goto drawing;
        }
        if (D_8005E294 == 3) {
            if (D_8005E3CE == D_8005E3CC) {
                D_8005E294 = 0;
                D_8005E5E8[0].unk18 = 1;
                D_8005E5E8[1].unk18 = 1;
                D_8005E5E8[0].unk17 = 0;
                D_8005E5E8[1].unk17 = 0;
                func_80012A68(0, 0, 0x140, 0x1E0, 0, 0, 0);
            } else if (D_8005E3CE < D_8005E3CC) {
                D_8005E3CC = D_8005E3CE;
            }
            s4 = 0xFF000 / D_8005E3CE;
            a3 = 0xFF;
        } else {
drawing:
            if (D_8005E3CC < D_8005E3CE + 1)
                goto div_path;
            a3 = 0xFF;
            if ((s16)D_8005E294 != 2 || D_8005E3CC <= D_8005E3CE + 6)
                D_8005E294 = 0;
            goto draw_join;
div_path:
            if (D_8005E3CE != 0) {
                s4 = 0xFF000 / D_8005E3CE;
                product = s4 * D_8005E3CC;
                if (product < 0)
                    product += 0xFFF;
                v1 = product >> 12;
                if (v1 < 0)
                    v1 = 0;
                if (v1 >= 0x100)
                    v1 = 0xFF;
                a3 = v1 & 0xFF;
                goto draw_join;
            }
            a3 = 0;
            D_8005E294 = 0;
draw_join:
            ;
        }
        if (D_8005E3D0 == 0)
            ot = D_8005E3B4;
        else
            ot = (s32 *)(D_8005E3C0->field_D8 + 0x14);
        if (a3 == 0)
            return;
        s0 = (POLY_F4 *)&D_8005E8E0[D_8005E3A4];
        s2 = (DR_MODE *)&D_8005E910[D_8005E3A4];
        if (D_8005E294 == 3) {
            if (D_8005E28C == 1) {
                D_8005E28C = 0;
                PutDispEnv((DISPENV *)&D_8005E644[D_8005E3A4]);
            }
            D_8005E5E8[0].unk18 = 0;
            D_8005E5E8[1].unk18 = 0;
            D_8005E5E8[0].unk17 = 1;
            D_8005E5E8[1].unk17 = 1;
            v1 = s4;
            if (v1 < 0)
                v1 += 0xFFF;
            v1 >>= 12;
            a2 = 2;
        } else {
            v1 = a3;
            a2 = D_8005E2A0;
        }
        setPolyF4(s0);
        setRGB0(s0, v1, v1, v1);
        setXYWH(s0, 0, 0, 0x140, 0xF0);
        setSemiTrans(s0, 1);
        setDrawMode(s2, 1, 1, ((a2 & 3) << 5), 0);
        addPrim(ot, s0);
        addPrim(ot, s2);
    }
}
