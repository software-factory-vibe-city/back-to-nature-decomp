#include "common.h"

void ovl_11_func_800F397C(u16 arg0, u16 arg1)
{
    u16 *p = &D_80070D3A;
    u16 v;

    switch (arg0)
    {
    case 0:
        D_80070D3A = D_80070D3A + 1;
        break;
    case 1:
        D_80070D3A = D_80070D3A + 1;
        break;
    case 2:
        D_80070D3A = arg1 + D_80070D3A;
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
