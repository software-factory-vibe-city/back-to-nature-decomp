#include "common.h"

void ovl_11_func_800F3A44(u16 arg0, u16 arg1)
{
    u16 *p = &D_80070D3E;
    u16 v;

    switch (arg0)
    {
    case 0:
        D_80070D3E = D_80070D3E + 1;
        break;
    case 1:
        D_80070D3E = arg1 + D_80070D3E;
        break;
    default:
        {
            u16 tmp;
            tmp = *p;
            *p = tmp + 1;
        }
        break;
    }

    v = *p;
    if (v > 999) {
        v = 999;
    }
    *p = v;
}