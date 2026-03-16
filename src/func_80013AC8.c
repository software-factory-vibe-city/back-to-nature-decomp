#include "common.h"

typedef struct {
    char pad_00[0x2C];
    s32 unk_2C;
    s32 unk_30;
} MyStruct;

/* Absolute addressing (lui+lw) requires > 8 bytes */
extern MyStruct *D_8005E3A8[3];
extern MyStruct *D_8005E3AC[3];

void func_80013AC8(s32 arg0, s32 arg1) {
    MyStruct *ptr_ac;
    MyStruct *ptr_a8;

    ptr_ac = D_8005E3AC[0];
    __asm__ volatile("" : "=r"(ptr_ac) : "0"(ptr_ac));
    ptr_a8 = D_8005E3A8[0];
    ptr_ac->unk_2C = arg0;
    ptr_a8->unk_2C = arg0;
    ptr_ac->unk_30 = arg1;
    ptr_a8->unk_30 = arg1;
}
