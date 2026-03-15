#include "common.h"

void func_80015880(void *arg0, s32 arg1, s32 arg2) {
    *(s32 *)((char *)arg0 + 0x14) = arg1;
    *(s32 *)((char *)arg0 + 0x18) = arg2;
}
