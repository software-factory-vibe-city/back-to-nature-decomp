#include "common.h"

extern s32 D_8005E4C8;
extern s16 D_8005E4C4;
extern s16 D_8005E4D0;
extern s16 D_8005E4C0;

void func_8001B4E4(s32 arg0) {
    /* register __asm__ required: v0 must be used for both struct ptr and sll result */
    register struct_8005E870 *sp __asm__("v0");
    register s32 idx32 __asm__("v0");
    register s32 *addr32 __asm__("v0");
    register s16 *addrC4 __asm__("v0");
    register s16 *addrD0 __asm__("v1");
    register s16 *addrC0 __asm__("a0");

    sp = &D_8005E870;
    sp->field_36 = 0;
    sp->field_37 = 0;
    idx32 = arg0 << 2;
    __asm__ volatile("" : "=r"(idx32) : "0"(idx32));
    addr32 = (s32 *)((char *)&D_8005E4C8 + idx32);
    __asm__ volatile("" : "=r"(addr32) : "0"(addr32));
    arg0 <<= 1;
    *addr32 = 0;
    addrC4 = (s16 *)((char *)&D_8005E4C4 + arg0);
    addrD0 = (s16 *)((char *)&D_8005E4D0 + arg0);
    __asm__ volatile("" : "=r"(addrC4) : "0"(addrC4));
    *addrC4 = 0;
    addrC0 = (s16 *)((char *)&D_8005E4C0 + arg0);
    *addrD0 = 0;
    *addrC0 = 0;
}
