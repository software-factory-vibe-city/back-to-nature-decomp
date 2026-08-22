#include "common.h"

int FntPrint();
int McxAllInfo(int, unsigned char *);
int sprintf(char *, const char *, ...);

extern char D_800B8194[];
extern char D_800B81B4[];
extern char D_800B81D8[];
extern char D_800B81E4[];
extern char D_800B81F0[];
extern char D_800B821C[];
extern char D_800B8224[];
extern char D_800B822C[];
extern char D_800B8244[];
extern char D_800B824C[];
extern char D_800B825C[];
extern char D_800B8268[];
extern char D_800B8278[];
extern char *D_800BB7C8[];
extern char *D_800BB7D8[];
extern char D_800BB8DC[];

int ovl_10_func_800B92D0(int arg0) {
    char buf[16];
    unsigned char *p;

    if (arg0 == 2) {
        return McxAllInfo(0, (unsigned char *)D_800BB8DC);
    }
    FntPrint(D_800B8194, D_800BB8DC[0] | (D_800BB8DC[1] << 8));
    FntPrint(D_800B81B4, D_800BB8DC[0xF] != 0 ? D_800B81D8 : D_800B81E4);
    FntPrint(D_800B81F0, D_800BB8DC[2] != 0 ? D_800B821C : D_800B8224,
             D_800BB7C8[D_800BB8DC[3]]);
    FntPrint(D_800B822C, *(int *)&D_800BB8DC[4]);
    p = (unsigned char *)D_800BB8DC + 8;
    sprintf(buf, D_800B8244, D_800BB8DC[8], p[1]);
    FntPrint(D_800B824C, buf);
    FntPrint(D_800B825C, p[2], p[3], D_800BB7D8[p[4]]);
    sprintf(buf, D_800B8268, p[5], p[6], p[7]);
    FntPrint(D_800B8278, buf);
    return 0;
}
