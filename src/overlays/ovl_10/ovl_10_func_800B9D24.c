#include "common.h"

int FntPrint();
int McxExecApl(int, int, long);
void ovl_10_func_800B92AC(void);
int ovl_10_func_800BB728(int);
int sprintf(char *, const char *, ...);

extern char D_800B8328[];
extern char D_800B8330[];
extern char D_800B8358[];
extern char D_800B8360[];
extern char D_800B8458[];
extern char D_800B8490[];
extern char D_800B84B0[];
extern char D_800B84D0[];
extern int D_800BB844;
extern int D_800BB848;
extern int D_800BB84C;
extern int D_800BB850;
extern int D_800BB854;
extern int D_800BB994;
extern short D_800BB99C[];

int ovl_10_func_800B9D24(int arg0, int arg1) {
    char buf[16];
    int s0;

    switch (arg0) {
    case 0:
        if (D_800BB994 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB844 < 4) {
                    D_800BB844 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB844 > 0)) {
                D_800BB844 -= 1;
            }
            if (arg1 & 0x1000) {
                D_800BB844 = 0;
            } else if (arg1 & 0x4000) {
                if (D_800BB844 == 0) {
                    D_800BB844 = 1;
                }
            }
        }
        D_800BB994 = arg1 & 0xF000;

        if (arg1 & 0x10) {
            D_800BB848 += 1;
            if (ovl_10_func_800BB728(D_800BB848) != 0) {
                D_800BB99C[D_800BB844] = (D_800BB99C[D_800BB844] + 0x10) & 0xFF;
            }
        } else {
            D_800BB848 = 0;
            if (arg1 & 0x80) {
                D_800BB84C += 1;
                if (ovl_10_func_800BB728(D_800BB84C) != 0) {
                    D_800BB99C[D_800BB844] = (D_800BB99C[D_800BB844] + 0xF0) & 0xFF;
                }
            } else {
                D_800BB84C = 0;
            }
        }

        if (arg1 & 0x20) {
            D_800BB850 += 1;
            if (ovl_10_func_800BB728(D_800BB850) != 0) {
                D_800BB99C[D_800BB844] = (D_800BB99C[D_800BB844] & 0xF0) +
                                         (((D_800BB99C[D_800BB844] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB850 = 0;
            if (arg1 & 0x40) {
                D_800BB854 += 1;
                if (ovl_10_func_800BB728(D_800BB854) != 0) {
                    if ((D_800BB844 == 0) && (D_800BB99C[0] == 0)) {
                        D_800BB99C[0] = -1;
                    } else {
                        D_800BB99C[D_800BB844] = (D_800BB99C[D_800BB844] & 0xF0) +
                                                 (((D_800BB99C[D_800BB844] & 0xF) + 0xF) & 0xF);
                    }
                }
            } else {
                D_800BB854 = 0;
            }
        }

        if ((D_800BB844 == 0) && (D_800BB99C[0] != -1)) {
            D_800BB99C[0] &= 0xF;
        }
        return 0;
    case 1:
        FntPrint(&D_800B8458);
        FntPrint(&D_800B8490, D_800BB844 != 0 ? &D_800B8360 : &D_800B8358,
                 D_800BB99C[0]);
        FntPrint(&D_800B84B0);
        for (s0 = 0; s0 < 4; s0++) {
            sprintf(buf, &D_800B8328, D_800BB99C[s0 + 1]);
            if (s0 + 1 == D_800BB844) {
                FntPrint(&D_800B8330, buf);
            } else {
                FntPrint(buf);
            }
        }
        FntPrint(&D_800B84D0);
        return 0;
    case 2:
        return McxExecApl(0, D_800BB99C[0], (D_800BB99C[1] << 24) |
                                                (D_800BB99C[2] << 16) |
                                                (D_800BB99C[3] << 8) |
                                                D_800BB99C[4]);
    case 3:
        ovl_10_func_800B92AC();
        return 0;
    default:
        return 0;
    }
}
