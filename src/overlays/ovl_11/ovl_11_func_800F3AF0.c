#include "common.h"

void ovl_11_func_800F3AF0(u16 arg0, u16 arg1)
{
    u16 *p = &D_80070D40;
    u16 v;

    switch (arg0)
    {
    case 0:
        D_80070D40 = D_80070D40 + 1;
        break;
    case 1:
        D_80070D40 = D_80070D40 + 10;
        break;
    case 2:
        D_80070D40 = arg1 + D_80070D40;
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
