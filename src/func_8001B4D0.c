#include "common.h"

extern s32 D_8005E4C8;

void func_8001B4D0(s32 arg0, s32 arg1) {
    arg0 <<= 2;
    *(s32*)((char*)&D_8005E4C8 + arg0) = arg1;
}
