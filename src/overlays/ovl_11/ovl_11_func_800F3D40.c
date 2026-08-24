#include "common.h"

void ovl_11_func_800F3D40(void) {
    s32 i;
    unsigned char *p1;
    unsigned char *p2;
    unsigned char *b1;
    unsigned char *b2;

    i = 0x15;
    b1 = (unsigned char *)&D_8006C838;
    p1 = b1 + 0x4AD5;
    do {
        *p1 = 0;
        p1--;
        i--;
    } while (i >= 0);

    i = 9;
    b2 = (unsigned char *)&D_8006C838;
    p2 = b2 + 0x4ADF;
    do {
        *p2 = 0;
        p2--;
        i--;
    } while (i >= 0);
}
