#include "common.h"

extern s16 D_8005E294;
extern s32 D_8005E298;
extern s16 D_8005E2A0;
extern s16 D_8005E3CC;
extern s16 D_8005E3CE;
extern s32 D_8005E3D0;

void func_800132B8(s32 arg0, s32 arg1, s32 arg2) {
    register s32 a0 __asm__("a0");
    register s32 a1 __asm__("a1");
    s32 temp_v0;
    
    temp_v0 = 1;
    __asm__ volatile("sll %0, %0, 0x10\n\tsra %0, %0, 0x10" : "+r"(arg0));
    a0 = arg0;
    __asm__ volatile("" : "=r"(temp_v0) : "0"(temp_v0));
    D_8005E294 = (s16) temp_v0;
    temp_v0 = a0 - 1;
    __asm__ volatile("sll %0, %0, 0x10\n\tsra %0, %0, 0x10" : "+r"(arg1));
    a1 = arg1;
    D_8005E3CC = (s16) temp_v0;
    D_8005E3CE = (s16) a0;
    D_8005E298 = 0;
    D_8005E2A0 = arg2;
    D_8005E3D0 = a1;
}
