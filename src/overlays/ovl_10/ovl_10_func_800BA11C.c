#include "common.h"

int FntPrint();
int McxCurrCtrl(int, int, int, int);

extern char D_800B84DC[];
extern char D_800B8514[];
extern char D_800B854C[];
extern char D_800B8590[];
extern char D_800B8594[];
extern char *D_800BB858[];
extern s32 D_800BB9A8;
extern s32 D_800BB9AC;
extern s32 D_800BB9B0;

s32 ovl_10_func_800BA11C(s32 arg0, s32 arg1) {
    switch (arg0) {
    case 0:
        if (D_800BB9B0 == 0) {
            if (arg1 & 0x10) {
                if (D_800BB9AC < 3) {
                    D_800BB9AC += 1;
                }
            } else if ((arg1 & 0x80) && (D_800BB9AC > 0)) {
                D_800BB9AC -= 1;
            }
        }
        D_800BB9B0 = arg1 & 0x90;
        if (arg1 & 0x20) {
            D_800BB9A8 = 1;
        } else if (arg1 & 0x40) {
            D_800BB9A8 = 0;
        }
        return 0;
    case 1:
        FntPrint(&D_800B84DC);
        FntPrint(&D_800B8514);
        FntPrint(&D_800B854C, D_800BB9A8 != 0 ? &D_800B8590 : &D_800B8594,
                 D_800BB858[D_800BB9AC]);
        return 0;
    case 2:
        return McxCurrCtrl(0, D_800BB9A8, D_800BB9AC, 0);
    case 3:
        ovl_10_func_800B92AC();
        return 0;
    default:
        return 0;
    }
}
