#include "common.h"

int FntPrint();
int McxWriteDev(int, int, unsigned char *, unsigned char *);
void ovl_10_func_800B92AC(void);
int ovl_10_func_800BB728(int);
int sprintf(char *, const char *, ...);

int ovl_10_func_800BB264(int arg0, int arg1) {
    char buf[16];
    int s1;
    int s2;
    int s3;

    switch (arg0) {
    case 0:
        if (D_800BBA44 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB8B8 < 0x9F) {
                    D_800BB8B8 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB8B8 >= 0)) {
                D_800BB8B8 -= 1;
            }
            if (arg1 & 0x1000) {
                D_800BB8B8 -= 0x10;
                if (D_800BB8B8 < 0) {
                    D_800BB8B8 = -1;
                }
            } else if (arg1 & 0x4000) {
                if (D_800BB8B8 < 0) {
                    D_800BB8B8 = 0;
                } else if (D_800BB8B8 + 0x10 < 0xA0) {
                    D_800BB8B8 += 0x10;
                }
            }
        }
        D_800BBA44 = arg1 & 0xF000;

        if (arg1 & 0x10) {
            D_800BB8BC += 1;
            if (ovl_10_func_800BB728(D_800BB8BC) != 0) {
                D_800BBA4C[D_800BB8B8 + 1] += 0x10;
            }
        } else {
            D_800BB8BC = 0;
            if (arg1 & 0x80) {
                D_800BB8C0 += 1;
                if (ovl_10_func_800BB728(D_800BB8C0) != 0) {
                    D_800BBA4C[D_800BB8B8 + 1] += 0xF0;
                }
            } else {
                D_800BB8C0 = 0;
            }
        }

        if (arg1 & 0x20) {
            D_800BB8C4 += 1;
            if (ovl_10_func_800BB728(D_800BB8C4) != 0) {
                D_800BBA4C[D_800BB8B8 + 1] =
                    (D_800BBA4C[D_800BB8B8 + 1] & 0xF0) +
                    (((D_800BBA4C[D_800BB8B8 + 1] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB8C4 = 0;
            if (arg1 & 0x40) {
                D_800BB8C8 += 1;
                if (ovl_10_func_800BB728(D_800BB8C8) != 0) {
                    D_800BBA4C[D_800BB8B8 + 1] =
                        (D_800BBA4C[D_800BB8B8 + 1] & 0xF0) +
                        (((D_800BBA4C[D_800BB8B8 + 1] & 0xF) + 0xF) & 0xF);
                }
            } else {
                D_800BB8C8 = 0;
            }
        }
        return 0;

    case 1: {
        FntPrint(&D_800B87C8);
        FntPrint(&D_800B87FC);
        FntPrint(&D_800B8840, D_800BB8B8 == -1 ? &D_800B8358 : &D_800B8360,
                 D_800BBA4C[0]);
        for (s3 = 0; s3 < 2; s3++) {
            FntPrint(s3 != 0 ? &D_800B885C : &D_800B8868);
            s1 = 0;
            s2 = s3 << 4;
            while (s1 < 0x10) {
                sprintf(buf, &D_800B86C4, D_800BBA4C[s1 + s2 + 1]);
                if (s1 + s2 == D_800BB8B8) {
                    FntPrint(&D_800B8330, buf);
                } else {
                    FntPrint(buf);
                }
                s1++;
            }
            FntPrint(&D_800B7EE8);
        }
        for (s3 = 0; s3 < 8; s3++) {
            FntPrint(s3 != 0 ? &D_800B885C : &D_800B8884);
            s1 = 0;
            s2 = s3 << 4;
            while (s1 < 0x10) {
                sprintf(buf, &D_800B86C4, D_800BBA4C[s2 + s1 + 0x21]);
                if (s2 + s1 == D_800BB8B8 - 0x20) {
                    FntPrint(&D_800B8330, buf);
                } else {
                    FntPrint(buf);
                }
                s1++;
            }
            FntPrint(&D_800B7EE8);
        }
        FntPrint(&D_800B7E40);
        return 0;
    }

    case 2:
        return McxWriteDev(0, D_800BBA4C[0], &D_800BBA4C[1], &D_800BBA4C[0x21]);

    case 3:
        ovl_10_func_800B92AC();
        return 0;

    default:
        return 0;
    }
}