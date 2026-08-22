#include "common.h"

int FntPrint();

extern char D_800B7F24[];
extern char D_800B7F78[];
extern char D_800B8020[];
extern char D_800B8074[];
extern char D_800B7EE8[];
extern char *D_800BBB3C[];

void ovl_10_func_800B9060(void) {
    FntPrint(&D_800B7F24, D_800BBB3C[0], D_800BBB3C[5], D_800BBB3C[10]);
    FntPrint(&D_800B7F78, D_800BBB3C[1], D_800BBB3C[6], D_800BBB3C[11]);
    FntPrint(&D_800B7FCC, D_800BBB3C[2], D_800BBB3C[7], D_800BBB3C[12]);
    FntPrint(&D_800B8020, D_800BBB3C[3], D_800BBB3C[8], D_800BBB3C[13]);
    FntPrint(&D_800B8074, D_800BBB3C[4], D_800BBB3C[9], D_800BBB3C[14]);
    FntPrint(&D_800B7EE8);
}
