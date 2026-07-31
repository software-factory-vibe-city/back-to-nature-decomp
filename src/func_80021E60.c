#include "common.h"

/* Initializes a 19-entry pool table over the array of 0x18-byte elements at
 * D_8004ED04: a pointer array (+0x5D8C) and a parallel u16 count array
 * (+0x5DD8), where each pointer is the running sum of the preceding counts
 * (ptr[i+1] = ptr[i] + count[i] * 0x18; 197 elements total).
 *
 * Store order matters for the match: both arrays in natural ascending offset
 * order. See notes/research/func_80021E60-sched1-single-set-priority-gap.md */
void func_80021E60(s32 arg0) {
    s32 *base;
    s32 *base2;
    s32 *ptr;

    base = (s32 *)&D_8006C838;

    base[0x20 >> 2] = (s32)&D_8004B1A4;
    base[0x24 >> 2] = (s32)&D_80049B1C;
    base[0x28 >> 2] = (s32)&D_8004AFBC;
    base[0x2C >> 2] = (s32)&D_8004B044;
    base[0x34 >> 2] = (s32)&D_80054BC8;

    if (arg0 == 0) {
        base2 = base + (0x8000 >> 2);
        ptr = (s32 *)&D_8004ED04;

        base2[0x5D8C >> 2] = (s32)ptr;
        base2[0x5D90 >> 2] = (s32)((char *)ptr + 0x60);
        base2[0x5D94 >> 2] = (s32)((char *)ptr + 0x150);
        base2[0x5D98 >> 2] = (s32)((char *)ptr + 0x360);
        base2[0x5D9C >> 2] = (s32)((char *)ptr + 0x480);
        base2[0x5DA0 >> 2] = (s32)((char *)ptr + 0x5A0);
        base2[0x5DA4 >> 2] = (s32)((char *)ptr + 0x6C0);
        base2[0x5DA8 >> 2] = (s32)((char *)ptr + 0x840);
        base2[0x5DAC >> 2] = (s32)((char *)ptr + 0x960);
        base2[0x5DB0 >> 2] = (s32)((char *)ptr + 0xA08);
        base2[0x5DB4 >> 2] = (s32)((char *)ptr + 0xA80);
        base2[0x5DB8 >> 2] = (s32)((char *)ptr + 0xBB8);
        base2[0x5DBC >> 2] = (s32)((char *)ptr + 0xCF0);
        base2[0x5DC0 >> 2] = (s32)((char *)ptr + 0xDF8);
        base2[0x5DC4 >> 2] = (s32)((char *)ptr + 0xED0);
        base2[0x5DC8 >> 2] = (s32)((char *)ptr + 0x1038);
        base2[0x5DCC >> 2] = (s32)((char *)ptr + 0x1068);
        base2[0x5DD0 >> 2] = (s32)((char *)ptr + 0x1158);
        base2[0x5DD4 >> 2] = (s32)((char *)ptr + 0x1248);

        *(u16 *)((u8 *)base2 + 0x5DD8) = 4;
        *(u16 *)((u8 *)base2 + 0x5DDA) = 0xA;
        *(u16 *)((u8 *)base2 + 0x5DDC) = 0x16;
        *(u16 *)((u8 *)base2 + 0x5DDE) = 0xC;
        *(u16 *)((u8 *)base2 + 0x5DE0) = 0xC;
        *(u16 *)((u8 *)base2 + 0x5DE2) = 0xC;
        *(u16 *)((u8 *)base2 + 0x5DE4) = 0x10;
        *(u16 *)((u8 *)base2 + 0x5DE6) = 0xC;
        *(u16 *)((u8 *)base2 + 0x5DE8) = 7;
        *(u16 *)((u8 *)base2 + 0x5DEA) = 5;
        *(u16 *)((u8 *)base2 + 0x5DEC) = 0xD;
        *(u16 *)((u8 *)base2 + 0x5DEE) = 0xD;
        *(u16 *)((u8 *)base2 + 0x5DF0) = 0xB;
        *(u16 *)((u8 *)base2 + 0x5DF2) = 9;
        *(u16 *)((u8 *)base2 + 0x5DF4) = 0xF;
        *(u16 *)((u8 *)base2 + 0x5DF6) = 2;
        *(u16 *)((u8 *)base2 + 0x5DF8) = 0xA;
        *(u16 *)((u8 *)base2 + 0x5DFA) = 0xA;
        *(u16 *)((u8 *)base2 + 0x5DFC) = 2;
    }
}
