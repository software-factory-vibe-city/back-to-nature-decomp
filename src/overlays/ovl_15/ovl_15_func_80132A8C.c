#include "common.h"

s32 func_80012A34(s32 arg0);
extern s32 D_801375D8[][4];

struct ovl_15_80132A8C_data {
    s16 pad0[17];
    s16 field_22;
    s16 pad1[6];
    s16 field_30;
    s16 pad2[3];
    s32 field_38;
    s32 field_3C;
    s32 field_40;
};

void ovl_15_func_80132A8C(struct ovl_15_80132A8C_data *arg0, s16 arg1) {
    s16 q = arg1 / 5;
    s16 r = arg1 % 5;
    s32 temp;

    arg0->field_38 = D_801375D8[q][0] + r * 0x190;
    arg0->field_3C = D_801375D8[q][1];
    arg0->field_40 = D_801375D8[q][2];
    temp = func_80012A34(4);
    arg0->field_22 = temp;
    arg0->field_30 = 4;
}
