#include "common.h"

int FntPrint();

extern u32 D_800BB7BC;
extern char D_800B80C8[];

int ovl_10_func_800BA11C(int, int);
int ovl_10_func_800BA2A0(int, int);
int ovl_10_func_800B9D24(int, int);
int ovl_10_func_800B9AA8(int, int);
int ovl_10_func_800BB264(int, int);
int ovl_10_func_800BADA4(int, int);
int ovl_10_func_800BAB10(int, int);
int ovl_10_func_800BA394(int, int);
int ovl_10_func_800B95F0(int, int);
int ovl_10_func_800BACBC(int, int);
int ovl_10_func_800B92D0(int);
int ovl_10_func_800B9458(int);
int ovl_10_func_800B94A4(int);
int ovl_10_func_800B95A4(int);
int ovl_10_func_800B956C(int);

int ovl_10_func_800B9108(s32 arg0, s32 arg1) {
    switch (D_800BB7BC) {
    case 1:
        return ovl_10_func_800BA11C(arg0, arg1);
    case 2:
        return ovl_10_func_800BA2A0(arg0, arg1);
    case 3:
        return ovl_10_func_800B9D24(arg0, arg1);
    case 7:
        return ovl_10_func_800B9AA8(arg0, arg1);
    case 8:
        return ovl_10_func_800BB264(arg0, arg1);
    case 9:
        return ovl_10_func_800BADA4(arg0, arg1);
    case 10:
        return ovl_10_func_800BAB10(arg0, arg1);
    case 12:
        return ovl_10_func_800BA394(arg0, arg1);
    case 13:
        return ovl_10_func_800B95F0(arg0, arg1);
    case 14:
        return ovl_10_func_800BACBC(arg0, arg1);
    default:
        if (arg0 == 1) {
            FntPrint(D_800B80C8);
            return 0;
        }
        if ((u32) (arg0 - 2) < 2U) {
            switch (D_800BB7BC) {
            case 0:
                return ovl_10_func_800B92D0(arg0);
            case 4:
                return ovl_10_func_800B9458(arg0);
            case 5:
                return ovl_10_func_800B94A4(arg0);
            case 6:
                return ovl_10_func_800B95A4(arg0);
            case 11:
                return ovl_10_func_800B956C(arg0);
            default:
                return 0;
            }
        } else {
            return 0;
        }
    }
}
