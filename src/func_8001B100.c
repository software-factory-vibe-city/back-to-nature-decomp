#include "common.h"

extern s32 D_8005E2CC;

/* Setter for D_8005E2CC (clears to 0) - see func_8001B10C for getter */
void func_8001B100(void) {
    D_8005E2CC = 0;
}
