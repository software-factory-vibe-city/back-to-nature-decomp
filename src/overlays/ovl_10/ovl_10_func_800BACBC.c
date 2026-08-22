#include "common.h"

int FntPrint();
int McxSetLED(int, int);

extern char D_800B8430[];
extern char D_800B8434[];
extern char D_800B878C[];
extern char D_800B87AC[];
extern s32 D_800BB8A0;

void ovl_10_func_800B92AC(void);

int ovl_10_func_800BACBC(s32 arg0, s32 arg1) {
    switch (arg0) {
    case 0:
        if (arg1 & 0x20) {
            D_800BB8A0 = 1;
        } else if (arg1 & 0x40) {
            D_800BB8A0 = 0;
        }
        return 0;
    case 1:
        FntPrint(D_800B878C);
        FntPrint(D_800B87AC, D_800BB8A0 ? D_800B8430 : D_800B8434);
        return 0;
    case 2:
        return McxSetLED(0, D_800BB8A0);
    case 3:
        ovl_10_func_800B92AC();
        /* fallthrough */
    default:
        return 0;
    }
}
