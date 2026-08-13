#include "common.h"
#include "psyq/libspu.h"
#include "psyq/libsnd.h"
#include "psyq/libcd.h"

/* Tentative definitions — this TU owns these GP-relative globals. */
s32 D_8005E538;
s32 D_8005E53C;
s32 D_8005E558;
s32 D_8005E55C;

void func_8001FEA4(void) {
    register s32 one asm("$16") = 1; /* $s0 — constant 1 across call. */

    SsInit();
    SsSetTableSize((char *)&D_8006C398, 6, 1);
    SsSetTickMode(1);
    func_80020540(0x16);
    D_8005E538 = 0;
    D_8005E53C = 0;
    D_8005E558 = 0;
    D_8005E55C = one;
    SsUtReverbOff();
    D_8006C368.mask = 0x2C3;
    D_8006C368.mvol.left = 0x3FFF;
    D_8006C368.mvol.right = 0x3FFF;
    *(u16 *)((u16 *)&D_8006C368 + 8) = 0x1FFF;
    *(u16 *)((u16 *)&D_8006C368 + 9) = 0x1FFF;
    D_8006C368.cd.mix = one;
    SpuSetCommonAttr(&D_8006C368);
    SsSetSerialAttr(0, 0, 1);
    SsSetSerialVol(0, 0, 0);
    CdControl(9, 0, 0);
    func_8001FF98();
}
