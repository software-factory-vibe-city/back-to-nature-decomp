#include "common.h"

#include "psyq/stddef.h"
#include "psyq/libgte.h"

/* The SDK member reads/writes only the three vector components. */

/* TU-owned globals (GP-relative in this translation unit). */
s32 D_8005E528;
BoundsStruct_8001E878 *D_8005E518;

s32 func_8001E38C(void) {
    s32 result[3];
    s32 v1[3];
    s32 prod[3];
    s32 diff1[3];
    s32 diff2[3];

    if (D_8005E528 <= 0) {
        return 0;
    }

    v1[0] = D_80061EF8[1]->f0;
    v1[1] = D_80061EF8[1]->f2;
    v1[2] = D_80061EF8[1]->f4;

    diff1[0] = v1[0] - D_80061EF8[0]->f0;
    diff1[1] = v1[1] - D_80061EF8[0]->f2;
    diff1[2] = v1[2] - D_80061EF8[0]->f4;

    diff2[0] = D_80061EF8[2]->f0 - v1[0];
    diff2[1] = D_80061EF8[2]->f2 - v1[1];
    diff2[2] = D_80061EF8[2]->f4 - v1[2];

    OuterProduct0((VECTOR *)diff1, (VECTOR *)diff2, (VECTOR *)result);

    prod[0] = (D_8005E518->field_0 - v1[0]) * result[0];
    prod[2] = (D_8005E518->field_8 - v1[2]) * result[2];
    prod[1] = -(prod[0] + prod[2]);

    if (result[1] == 0) {
        return D_8005E518->field_4;
    }

    return (prod[1] / result[1]) + v1[1];
}
