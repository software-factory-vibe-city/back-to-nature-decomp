#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);
s32 ovl_19_func_800BA73C(Ovl19Func800BA73CArg *arg0);
s32 ovl_19_func_800BA468(s32 arg0, s32 arg1);
s32 ovl_19_func_800BA544(s32 arg0, s32 arg1);
void ovl_19_func_800BAC50(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2);

void ovl_19_func_800B9454(void) {
    s16 *s2;
    s16 *s1;
    s16 *s3;
    s16 *s6;
    s32 s4;
    s32 s5;
    s32 s0;
    s32 a0v;
    s32 v1v;

    s2 = D_800BF5A0;
    s3 = (s16 *)((u8 *)s2 - 0x88);
    s6 = (s16 *)((u8 *)s2 - 0xD0);

    if (s2[2] > 0) {
        *(u16 *)&s2[2] = *(u16 *)&s2[2] - 1;
        if ((s16)*(u16 *)&s2[2] <= 0) {
            s2[2] = 0;
            ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)s2, 1, 0);
        }
    } else {
        s1 = s2 - 0x70;
        if (s1[5] != s1[5] / s1[0xBD] * s1[0xBD]) {
            return;
        }
        s5 = func_80012A34(0x80);
        s4 = 0;
        s0 = ovl_19_func_800BA73C((Ovl19Func800BA73CArg *)s3);
        if (s0 == 1) {
            if (ovl_19_func_800BA468((s32)s3, (s32)s6) == s0) {
                a0v = s1[0xC5];
                v1v = s1[0xC4];
            } else if (ovl_19_func_800BA544((s32)s3, (s32)s6) == s0) {
                a0v = s1[0xC3];
                v1v = s1[0xC2];
            } else {
                a0v = s1[0xC1];
                v1v = s1[0xC0];
            }
        } else {
            a0v = s1[0xBF];
            v1v = s1[0xBE];
        }
        if (s3[4] < 0x51) {
            if (v1v < s5) {
                s4 = 1;
            }
        } else {
            if (s5 < a0v) {
                s4 = 1;
            }
        }
        if (s4 != 0) {
            ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)s2, 2, 0x1E);
        }
    }
}
