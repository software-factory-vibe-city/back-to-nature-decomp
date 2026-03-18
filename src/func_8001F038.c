#include "common.h"

extern s32 D_8005E2F4;
extern s32 D_8005E2F8;
extern s32 D_8005E2FC;
extern s32 D_8005E300;

void func_8001F038(s32 arg0, s32 arg1, s32 arg2) {
    if ((arg0 != D_8005E2F8) || (arg1 != D_8005E2FC) || (arg2 != D_8005E300)) {
        D_8005E2EE = 1;
        D_8005E2F4 = 0;
    }
    D_8005E2F8 = arg0;
    D_8005E2FC = arg1;
    D_8005E300 = arg2;
}
