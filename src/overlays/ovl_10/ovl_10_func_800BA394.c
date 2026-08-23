#include "common.h"

int FntPrint();
int McxSetMem(int, unsigned char *, unsigned, unsigned);
int sprintf(char *, const char *, ...);
void ovl_10_func_800B92AC(void);
s32 ovl_10_func_800BB728(s32);


s32 ovl_10_func_800BA394(s32 arg0, s32 arg1) {
    char buf[16];
    s32 s3;
    int s2;
    int s7;

    switch (arg0) {
    case 0:
        if (D_800BBA3C == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB868 < D_800BB86C[4] - 1) {
                    D_800BB868 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB868 >= -4)) {
                D_800BB868 -= 1;
            }
            if (arg1 & 0x1000) {
                if ((u32)D_800BB868 < 6U) {
                    D_800BB868 = -5;
                } else if (D_800BB868 == 6) {
                    D_800BB868 = -4;
                } else if ((u32)(D_800BB868 - 7) < 2U) {
                    D_800BB868 = -2;
                } else if ((u32)(D_800BB868 - 9) < 7U) {
                    D_800BB868 = -1;
                } else if (D_800BB868 < 0x10) {
                    /* leave the selection on a header entry */
                } else {
                    D_800BB868 -= 0x10;
                }
            } else if (arg1 & 0x4000) {
                switch (D_800BB868) {
                case -5:
                    if ((u32)D_800BB86C[4] >= 6U) {
                        D_800BB868 = 5;
                    }
                    break;
                case -4:
                case -3:
                    if ((u32)D_800BB86C[4] >= 7U) {
                        D_800BB868 = 6;
                    }
                    break;
                case -2:
                    if ((u32)D_800BB86C[4] >= 8U) {
                        D_800BB868 = 7;
                    }
                    break;
                case -1:
                    if ((u32)D_800BB86C[4] >= 0xBU) {
                        D_800BB868 = 0xA;
                    }
                    break;
                default:
                    if (D_800BB868 + 0x10 < D_800BB86C[4]) {
                        D_800BB868 += 0x10;
                    }
                    break;
                }
                if (D_800BB86C[4] != 0 && D_800BB868 < 0) {
                    D_800BB868 = D_800BB86C[4] - 1;
                }
            }
        }
        s3 = -1;
        D_800BBA3C = arg1 & 0xF000;
        if (D_800BB868 < 0) {
            s3 = D_800BB868 + 5;
        }

        if (arg1 & 0x10) {
            s32 v = D_800BB880 + 1;
            D_800BB880 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                if (D_800BB868 < 0) {
                    D_800BB86C[s3] = (D_800BB86C[s3] + 0x10) & 0xFF;
                } else {
                    D_800BB9BC[D_800BB868] = D_800BB9BC[D_800BB868] + 0x10;
                }
            }
        } else {
            D_800BB880 = 0;
            if (arg1 & 0x80) {
                s32 v = D_800BB884 + 1;
                D_800BB884 = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    if (D_800BB868 < 0) {
                        D_800BB86C[s3] = (D_800BB86C[s3] + 0xF0) & 0xFF;
                    } else {
                        D_800BB9BC[D_800BB868] = D_800BB9BC[D_800BB868] + 0xF0;
                    }
                }
            } else {
                D_800BB884 = 0;
            }
        }

        if (s3 >= 0) {
            if ((u32)D_800BB86C[4] >= 0x81U) {
                if (D_800BB86C[4] == 0x90) {
                    D_800BB86C[4] = 0;
                } else if (D_800BB86C[4] == 0xF0) {
                    D_800BB86C[4] = 0x80;
                } else {
                    D_800BB86C[4] &= 0x7F;
                }
            }
        }

        if (arg1 & 0x20) {
            s32 v = D_800BB888 + 1;
            D_800BB888 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                if (D_800BB868 < 0) {
                    D_800BB86C[s3] = (D_800BB86C[s3] & 0xF0) +
                                     (((D_800BB86C[s3] & 0xF) + 1) & 0xF);
                } else {
                    D_800BB9BC[D_800BB868] = (D_800BB9BC[D_800BB868] & 0xF0) +
                                             (((D_800BB9BC[D_800BB868] & 0xF) + 1) &
                                              0xF);
                }
            }
        } else {
            D_800BB888 = 0;
            if (arg1 & 0x40) {
                s32 v = D_800BB88C + 1;
                D_800BB88C = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    if (D_800BB868 < 0) {
                        D_800BB86C[s3] = (D_800BB86C[s3] & 0xF0) +
                                         (((D_800BB86C[s3] & 0xF) + 0xF) & 0xF);
                    } else {
                        D_800BB9BC[D_800BB868] =
                            (D_800BB9BC[D_800BB868] & 0xF0) +
                            (((D_800BB9BC[D_800BB868] & 0xF) + 0xF) & 0xF);
                    }
                }
            } else {
                D_800BB88C = 0;
            }
        }

        if ((u32)D_800BB86C[4] >= 0x81U) {
            D_800BB86C[4] -= 0x10;
        }
        break;

    case 1:
        s3 = D_800BB868 + 5;
        if (D_800BB868 >= 0) {
            s3 = -1;
        }
        FntPrint(D_800B861C);
        FntPrint(D_800B8644);
        FntPrint(D_800B866C);
        FntPrint(D_800B8694);
        FntPrint(D_800B830C);
        for (s2 = 0; s2 < 4; s2++) {
            sprintf(buf, D_800B8328, D_800BB86C[s2]);
            if (s2 == s3) {
                FntPrint(D_800B8330, buf);
            } else {
                FntPrint(buf);
            }
        }
        sprintf(buf, D_800B8328, D_800BB86C[4]);
        FntPrint(D_800B8340, s3 == 4 ? D_800B8358 : D_800B8360, buf);
        FntPrint(D_800B86BC);

        s7 = 0;
        do {
            FntPrint(D_800B8368);
            s2 = 0;
            if (s7 * 0x10 < (u32)D_800BB86C[4]) {
                do {
                    sprintf(buf, D_800B86C4, (s32)D_800BB9BC[s7 * 0x10 + s2]);
                    if (s7 * 0x10 + s2 == D_800BB868) {
                        FntPrint(D_800B8330, buf);
                    } else {
                        FntPrint(buf);
                    }
                    s2++;
                    if (s2 >= 0x10) {
                        break;
                    }
                } while ((u32)(s7 * 0x10 + s2) < (u32)D_800BB86C[4]);
            }
            FntPrint(D_800B7EE8);
            if ((u32)D_800BB86C[4] < (u32)(s7 * 0x10 + s2)) {
                break;
            }
            s7++;
        } while (s7 < 8);
        break;

    case 2:
        return McxSetMem(0, D_800BB9BC,
                         (D_800BB86C[0] << 24) | (D_800BB86C[1] << 16) |
                             (D_800BB86C[2] << 8) | D_800BB86C[3],
                         D_800BB86C[4]);

    case 3:
        ovl_10_func_800B92AC();
        break;
    }
    FntPrint(D_800B7E40);
    return 0;
}
