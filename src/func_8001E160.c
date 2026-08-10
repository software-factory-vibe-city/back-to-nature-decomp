#include "common.h"

extern unsigned long *ClearOTagR(unsigned long *ot, int n);

extern s32 D_8005E3B0;

void func_8001E160(void) {
    s32 base;
    s32 i;
    s32 *entry;
    s8 *ptr;
    s32 j;

    base = D_8005E3B0;

    for (i = 0; i < 2; i++) {
        entry = (s32 *)((s8 *)&D_8005E5E8 + i * 0x134);

        entry[0x44] = 0x800;
        entry[0x45] = 0xB;
        entry[0x48] = base + 0x290 + (i << 13);
        entry[0x49] = base + 0x4290 + (i * 0x17700);
        entry[0x47] = 0x17700;

        ClearOTagR((unsigned long *)entry[0x48], 0x800);

        for (j = 0; j <= 0x176FF; j++) {
            ptr = (s8 *)entry[0x49] + j;
            *ptr = 0;
        }

        entry[0x46] = entry[0x49];
    }
}
