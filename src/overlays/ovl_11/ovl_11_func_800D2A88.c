#include "common.h"

s32 func_80012A34(s32 arg0);
extern s32 D_80123A8C[][4];

struct ovl_11_800D2A88_data {
    s16 pad0[17];
    s16 field_22;
    s16 pad1[6];
    s16 field_30;
    s16 pad2[3];
    s32 field_38;
    s32 field_3C;
    s32 field_40;
};

void ovl_11_func_800D2A88(struct ovl_11_800D2A88_data *arg0, s16 arg1) {
    s16 q = arg1 / 5;
    s16 r = arg1 % 5;
    s32 temp;

    arg0->field_38 = D_80123A8C[q][0] + r * 0x190;
    arg0->field_3C = D_80123A8C[q][1];
    arg0->field_40 = D_80123A8C[q][2];
    temp = func_80012A34(4);
    arg0->field_22 = temp;
    arg0->field_30 = 4;
}
