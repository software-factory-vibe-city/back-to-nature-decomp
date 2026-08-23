#include "common.h"

int FntPrint();
int McxGetMem(int, unsigned char *, unsigned, unsigned);
int sprintf(char *, const char *, ...);
s32 ovl_10_func_800BB728(s32);

int ovl_10_func_800B95F0(int arg0, int arg1)
{
    int i;
    int row;
    char buf[16];

    switch (arg0) {
    case 0:
        if (D_800BB990 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB98C < 4) {
                    D_800BB98C += 1;
                }
            } else if ((arg1 & 0x8000) != 0 && D_800BB98C > 0) {
                D_800BB98C -= 1;
            }
        }
        D_800BB990 = arg1 & 0xA000;
        if (arg1 & 0x10) {
            D_800BB824 += 1;
            if (ovl_10_func_800BB728(D_800BB824) != 0) {
                D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] + 0x10) & 0xFF;
            }
        } else {
            D_800BB824 = 0;
            if (arg1 & 0x80) {
                D_800BB828 += 1;
                if (ovl_10_func_800BB728(D_800BB828) != 0) {
                    D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] + 0xF0) & 0xFF;
                }
            } else {
                D_800BB828 = 0;
            }
        }
        if (D_800BB810[4] >= 0x81U) {
            if (D_800BB810[4] == 0x90) {
                D_800BB810[4] = 0;
            } else if (D_800BB810[4] == 0xF0) {
                D_800BB810[4] = 0x80;
            } else {
                D_800BB810[4] &= 0x7F;
            }
        }
        if (arg1 & 0x20) {
            D_800BB82C += 1;
            if (ovl_10_func_800BB728(D_800BB82C) != 0) {
                D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] & 0xF0) +
                                         (((D_800BB810[D_800BB98C] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB82C = 0;
            if (arg1 & 0x40) {
                D_800BB830 += 1;
                if (ovl_10_func_800BB728(D_800BB830) != 0) {
                    D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] & 0xF0) +
                                             (((D_800BB810[D_800BB98C] & 0xF) + 0xF) & 0xF);
                }
            } else {
                D_800BB830 = 0;
            }
        }
        if (D_800BB810[4] >= 0x81U) {
            D_800BB810[4] -= 0x10;
        }
        return 0;
    case 1:
        FntPrint(&D_800B8280);
        FntPrint(&D_800B82AC);
        FntPrint(&D_800B82DC);
        FntPrint(&D_800B830C);
        for (i = 0; i < 4; i++) {
            sprintf(buf, &D_800B8328, D_800BB810[i]);
            if (i == D_800BB98C) {
                FntPrint(&D_800B8330, buf);
            } else {
                FntPrint(buf);
            }
        }
        sprintf(buf, &D_800B8328, D_800BB810[4]);
        FntPrint(&D_800B8340, (D_800BB98C == 4) ? &D_800B8358 : &D_800B8360, buf);
        return 0;
    case 2:
        return McxGetMem(0, D_800BB90C,
                         (D_800BB810[0] << 24) | (D_800BB810[1] << 16) |
                         (D_800BB810[2] << 8) | D_800BB810[3],
                         D_800BB810[4]);
    case 3:
        row = 0;
        do {
            FntPrint(&D_800B8368);
            i = 0;
            if ((unsigned)(row * 0x10) < D_800BB810[4]) {
                do {
                    sprintf(buf, &D_800B8328, D_800BB90C[row * 0x10 + i]);
                    FntPrint(&D_800B8370, buf);
                    i++;
                    if (i >= 0x10) {
                        break;
                    }
                } while ((unsigned)(row * 0x10 + i) < D_800BB810[4]);
            }
            FntPrint(&D_800B7EE8);
            if (D_800BB810[4] < (unsigned)(row * 0x10 + i)) {
                break;
            }
            row++;
        } while (row < 8);
        return 0;
    default:
        return 0;
    }
}
