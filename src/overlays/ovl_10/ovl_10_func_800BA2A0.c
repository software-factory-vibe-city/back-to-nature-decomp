#include "common.h"

int FntPrint();
int McxFlashAcs(int, int);
void ovl_10_func_800B92AC(void);

extern char D_800B81D8[];
extern char D_800B81E4[];
extern char D_800B8598[];
extern char D_800B85C4[];
extern char D_800B85F0[];
extern s32 D_800BB9B4;

int ovl_10_func_800BA2A0(int arg0, int arg1) {
    switch (arg0) {
    case 0:
        if (arg1 & 0x20) {
            D_800BB9B4 = 1;
        } else if (arg1 & 0x40) {
            D_800BB9B4 = 0;
        }
        break;
    case 1:
        FntPrint(&D_800B8598);
        FntPrint(&D_800B85C4);
        FntPrint(&D_800B85F0, D_800BB9B4 ? &D_800B81D8 : &D_800B81E4);
        break;
    case 2:
        return McxFlashAcs(0, D_800BB9B4);
    case 3:
        ovl_10_func_800B92AC();
        break;
    }
    return 0;
}
