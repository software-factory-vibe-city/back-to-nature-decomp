#include "common.h"

int FntPrint();
int McxGetTime(int, unsigned char *);
int sprintf(char *, const char *, ...);

extern char D_800B8244[];
extern char D_800B824C[];
extern char D_800B825C[];
extern char D_800B8268[];
extern char D_800B8278[];
extern int D_800BB7F4[];
extern char D_800BB8F4[];

int ovl_10_func_800B94A4(int arg0) {
    char buf[16];

    if (arg0 == 2) {
        return McxGetTime(0, (unsigned char *)D_800BB8F4);
    }
    sprintf(buf, D_800B8244, D_800BB8F4[0], D_800BB8F4[1]);
    FntPrint(D_800B824C, buf);
    FntPrint(D_800B825C, D_800BB8F4[2], D_800BB8F4[3], D_800BB7F4[D_800BB8F4[4]]);
    sprintf(buf, D_800B8268, D_800BB8F4[5], D_800BB8F4[6], D_800BB8F4[7]);
    FntPrint(D_800B8278, buf);
    return 0;
}
