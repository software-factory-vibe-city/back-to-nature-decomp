#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

u16 ovl_11_func_800EAF5C(s16 arg0) {
    switch (arg0) {
    case 0:
        func_8001AF70(4, 0);
        func_8001AF70(5, 1);
        func_8001AF70(0xB0, 1);
        break;
    case 1:
        func_8001AF70(4, 1);
        func_8001AF70(5, 0);
        func_8001AF70(0xB0, 0);
        break;
    case 2:
    default:
        func_8001AF70(4, 0);
        func_8001AF70(5, 0);
        func_8001AF70(0xB0, 0);
        break;
    }
    return 1;
}
