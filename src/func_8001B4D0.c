#include "common.h"

extern s32 D_8005E4C8;

void func_8001B4D0(s32 arg0, s32 arg1) {
    s32 *base;
    arg0 <<= 2;
    __asm__ volatile("" : "=r"(arg0) : "0"(arg0));
    base = &D_8005E4C8;
    *(s32*)((char*)base + arg0) = arg1;
}
