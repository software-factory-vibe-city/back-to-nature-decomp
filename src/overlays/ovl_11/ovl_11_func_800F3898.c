#include "common.h"

void ovl_11_func_800F3898(u16 arg0, u16 arg1)
{
    u16 *p = &D_80070D38;
    u16 v;

    switch (arg0)
    {
    case 0:
        D_80070D38 = D_80070D38 + 1;
        break;
    case 1:
        D_80070D38 = D_80070D38 + 1;
        break;
    case 2:
        D_80070D38 = D_80070D38 + 6;
        break;
    case 3:
        D_80070D38 = arg1 + D_80070D38;
        break;
    default:
        *p = *p + 1;
        break;
    }

    v = *p;
    if (v > 999) {
        v = 999;
    }
    *p = v;
}
